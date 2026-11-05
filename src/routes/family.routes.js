import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { transferFunds } from '../services/economy.service.js';

const router = express.Router();

/**
 * Get Citizen's Family Household & Tree
 */
router.get('/my-family', authenticate, requireCharacter, async (req, res) => {
  try {
    const memberRes = await query(`
      SELECT f.*, fm.role AS my_role
      FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE fm.profile_id = $1
      LIMIT 1;
    `, [req.user.profile_id]);

    if (memberRes.rows.length === 0) {
      return res.json({ family: null, members: [] });
    }

    const family = memberRes.rows[0];

    const allMembersRes = await query(`
      SELECT fm.role, fm.joined_at, p.id AS profile_id, p.character_name, p.username, p.virtual_age, p.life_stage,
             a.sprite_url
      FROM family_members fm
      JOIN player_profiles p ON p.id = fm.profile_id
      LEFT JOIN avatars a ON a.id = p.avatar_id
      WHERE fm.family_id = $1
      ORDER BY p.virtual_age DESC;
    `, [family.id]);

    return res.json({
      family,
      members: allMembersRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch family: ' + err.message });
  }
});

/**
 * Update Family Household Settings (e.g., Toggle Child Acceptance Consent)
 */
router.post('/settings', authenticate, requireCharacter, async (req, res) => {
  try {
    const { acceptingChildren, motto } = req.body;

    const famRes = await query(`
      SELECT family_id FROM family_members 
      WHERE profile_id = $1 
      LIMIT 1;
    `, [req.user.profile_id]);

    if (famRes.rows.length === 0) {
      return res.status(404).json({ error: 'No active household.' });
    }

    const familyId = famRes.rows[0].family_id;

    await query(`
      UPDATE families 
      SET accepting_children = COALESCE($1, accepting_children),
          motto = COALESCE($2, motto)
      WHERE id = $3;
    `, [acceptingChildren, motto, familyId]);

    return res.json({ success: true, message: 'Household settings updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update household settings.' });
  }
});

/**
 * Transfer Inherited Property / Funds to Family Member
 */
router.post('/transfer-property', authenticate, requireCharacter, async (req, res) => {
  try {
    const { targetProfileId, amount, note } = req.body;
    const planetId = req.user.planet_id || 1;

    // Verify target is in the same family
    const checkRes = await query(`
      SELECT fm1.family_id 
      FROM family_members fm1
      JOIN family_members fm2 ON fm2.family_id = fm1.family_id AND fm2.profile_id = $2
      WHERE fm1.profile_id = $1;
    `, [req.user.profile_id, targetProfileId]);

    if (checkRes.rows.length === 0) {
      return res.status(400).json({ error: 'Target citizen is not part of your verified family household.' });
    }

    await transferFunds({
      planetId,
      fromProfileId: req.user.profile_id,
      toProfileId: parseInt(targetProfileId, 10),
      amount: parseFloat(amount),
      transactionType: 'inheritance',
      description: note || 'Family property & wealth transfer'
    });

    return res.json({ success: true, message: `Transferred ₡${parseFloat(amount).toFixed(2)} to family member.` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;

