import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, optionalAuth, requireCharacter } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

/**
 * Get All Nations of Aethel with Government & Constitution Data
 */
router.get('/nations', optionalAuth, async (req, res) => {
  try {
    const nationsRes = await query(`
      SELECT c.*,
             (SELECT name FROM cities ci WHERE ci.country_id = c.id ORDER BY id ASC LIMIT 1) AS capital_city,
             (SELECT COUNT(*) FROM cities ci WHERE ci.country_id = c.id) AS cities_count,
             (SELECT COUNT(*) FROM player_profiles p WHERE p.country_id = c.id) AS citizens_count
      FROM countries c
      WHERE c.is_active = TRUE
      ORDER BY c.id ASC;
    `);

    return res.json({
      nations: nationsRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch nations: ' + err.message });
  }
});

/**
 * Get Country Government, Cabinet & Enacted Laws
 */
router.get('/current', authenticate, requireCharacter, async (req, res) => {
  try {
    const countryId = req.user.country_id || 1;

    const govRes = await query(`
      SELECT g.*, c.name AS country_name, c.tax_rate, c.treasury_balance
      FROM governments g
      JOIN countries c ON c.id = g.country_id
      WHERE g.country_id = $1;
    `, [countryId]);

    const lawsRes = await query(`
      SELECT * FROM laws 
      WHERE country_id = $1 
      ORDER BY created_at DESC;
    `, [countryId]);

    const partiesRes = await query(`
      SELECT pp.*, p.character_name AS leader_name
      FROM political_parties pp
      LEFT JOIN player_profiles p ON p.id = pp.leader_profile_id
      WHERE pp.country_id = $1;
    `, [countryId]);

    return res.json({
      government: govRes.rows[0] || null,
      laws: lawsRes.rows,
      parties: partiesRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch government state: ' + err.message });
  }
});

/**
 * Get Active Elections
 */
router.get('/elections', authenticate, requireCharacter, async (req, res) => {
  try {
    const countryId = req.user.country_id || 1;

    const electionsRes = await query(`
      SELECT e.*,
             (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS total_votes,
             EXISTS(SELECT 1 FROM votes v WHERE v.election_id = e.id AND v.voter_profile_id = $1) AS has_voted
      FROM elections e
      WHERE e.country_id = $2
      ORDER BY e.created_at DESC;
    `, [req.user.profile_id, countryId]);

    // Fetch candidate profiles (defaulting to key figures/NPCs/leaders)
    const candidatesRes = await query(`
      SELECT id, character_name, username, virtual_age, life_stage
      FROM player_profiles 
      WHERE country_id = $1 
      LIMIT 6;
    `, [countryId]);

    return res.json({
      elections: electionsRes.rows,
      candidates: candidatesRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch elections.' });
  }
});

/**
 * Cast a Vote in an Election (Enforces 1 Vote per Citizen per Election)
 */
router.post('/vote', authenticate, requireCharacter, async (req, res) => {
  try {
    const { electionId, candidateProfileId } = req.body;
    const eId = parseInt(electionId, 10);
    const cId = parseInt(candidateProfileId, 10);

    const electionCheck = await query('SELECT status FROM elections WHERE id = $1;', [eId]);
    if (electionCheck.rows.length === 0 || electionCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'This election is not currently accepting votes.' });
    }

    const voteCheck = await query('SELECT id FROM votes WHERE election_id = $1 AND voter_profile_id = $2;', [eId, req.user.profile_id]);
    if (voteCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You have already cast your ballot in this election.' });
    }

    await query(`
      INSERT INTO votes (election_id, voter_profile_id, candidate_profile_id)
      VALUES ($1, $2, $3);
    `, [eId, req.user.profile_id, cId]);

    // Update mission progress if active
    await query(`
      UPDATE player_missions 
      SET progress = progress + 1 
      WHERE profile_id = $1 AND status = 'active' AND mission_id IN (
        SELECT id FROM missions WHERE requirements->>'type' = 'vote'
      );
    `, [req.user.profile_id]).catch(() => {});

    // Award Statesman Achievement
    const achRes = await query('SELECT id FROM achievements WHERE code = $1;', ['STATESMAN']);
    if (achRes.rows.length > 0) {
      await query(`
        INSERT INTO player_achievements (profile_id, achievement_id)
        VALUES ($1, $2)
        ON CONFLICT (profile_id, achievement_id) DO NOTHING;
      `, [req.user.profile_id, achRes.rows[0].id]);
    }

    await logAudit({
      userId: req.user.id,
      profileId: req.user.profile_id,
      action: 'VOTE_CAST',
      entityType: 'election',
      entityId: eId,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Your vote has been securely recorded on the planetary electoral ledger!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cast ballot: ' + err.message });
  }
});

/**
 * Register Political Party
 */
router.post('/parties/create', authenticate, requireCharacter, async (req, res) => {
  try {
    const { name, abbreviation, ideology } = req.body;
    if (!name || !abbreviation) {
      return res.status(400).json({ error: 'Party name and abbreviation are required.' });
    }

    const partyRes = await query(`
      INSERT INTO political_parties (country_id, name, abbreviation, ideology, leader_profile_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [
      req.user.country_id || 1,
      name.trim(),
      abbreviation.trim().toUpperCase(),
      ideology || 'Advancement of citizen welfare and progress.',
      req.user.profile_id
    ]);

    return res.status(201).json({
      success: true,
      message: `Political party "${name}" has been registered with the Parliamentary Bureau!`,
      party: partyRes.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register political party: ' + err.message });
  }
});

/**
 * Propose New Law / Bill
 */
router.post('/laws/propose', authenticate, requireCharacter, async (req, res) => {
  try {
    const { title, description, category = 'Civil Rights' } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Bill title and description are required.' });
    }

    const lawRes = await query(`
      INSERT INTO laws (country_id, title, description, category, status)
      VALUES ($1, $2, $3, $4, 'proposed')
      RETURNING *;
    `, [req.user.country_id || 1, title.trim(), description.trim(), category]);

    return res.status(201).json({
      success: true,
      message: `Bill "${title}" has been placed on the Parliamentary voting calendar!`,
      law: lawRes.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to propose legislation.' });
  }
});

export default router;

