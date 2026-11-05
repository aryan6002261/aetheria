import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { grantFunds } from '../services/economy.service.js';

const router = express.Router();

/**
 * Get Active Missions for Player
 */
router.get('/', authenticate, requireCharacter, async (req, res) => {
  try {
    // Ensure all active global missions have a player_mission tracking row
    const globalMissions = await query('SELECT * FROM missions WHERE is_active = TRUE;');

    for (const m of globalMissions.rows) {
      await query(`
        INSERT INTO player_missions (profile_id, mission_id, progress, target, status)
        VALUES ($1, $2, 0, $3, 'active')
        ON CONFLICT (profile_id, mission_id) DO NOTHING;
      `, [req.user.profile_id, m.id, m.requirements?.count || 1]);
    }

    const playerMissionsRes = await query(`
      SELECT pm.*, m.title, m.description, m.category, m.xp_reward, m.currency_reward, m.rep_reward
      FROM player_missions pm
      JOIN missions m ON m.id = pm.mission_id
      WHERE pm.profile_id = $1
      ORDER BY pm.status ASC, m.id ASC;
    `, [req.user.profile_id]);

    return res.json({ missions: playerMissionsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch missions: ' + err.message });
  }
});

/**
 * Claim Mission Reward (Anti-Abuse Server-Validated)
 */
router.post('/:id/claim', authenticate, requireCharacter, async (req, res) => {
  try {
    const missionId = parseInt(req.params.id, 10);

    const pmRes = await query(`
      SELECT pm.*, m.title, m.xp_reward, m.currency_reward, m.rep_reward, m.achievement_id
      FROM player_missions pm
      JOIN missions m ON m.id = pm.mission_id
      WHERE pm.profile_id = $1 AND pm.mission_id = $2;
    `, [req.user.profile_id, missionId]);

    if (pmRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mission assignment not found.' });
    }

    const pm = pmRes.rows[0];
    if (pm.status === 'claimed') {
      return res.status(400).json({ error: 'Reward for this mission has already been claimed.' });
    }

    // Auto-complete if progress >= target
    if (pm.progress < pm.target) {
      return res.status(400).json({ error: `Mission objectives not yet satisfied (${pm.progress}/${pm.target}).` });
    }

    // Mark claimed
    await query(`
      UPDATE player_missions 
      SET status = 'claimed', completed_at = CURRENT_TIMESTAMP 
      WHERE id = $1;
    `, [pm.id]);

    // Grant currency
    const rewardCredits = parseFloat(pm.currency_reward);
    if (rewardCredits > 0) {
      await grantFunds({
        planetId: req.user.planet_id || 1,
        toProfileId: req.user.profile_id,
        amount: rewardCredits,
        transactionType: 'reward',
        referenceType: 'mission',
        referenceId: pm.mission_id,
        description: `Mission reward for "${pm.title}"`
      });
    }

    // Grant XP and Reputation
    await query(`
      UPDATE player_profiles 
      SET experience_points = experience_points + $1,
          reputation = reputation + $2,
          level = CASE 
            WHEN experience_points + $1 >= level * 250 
            THEN level + 1 
            ELSE level 
          END
      WHERE id = $3;
    `, [pm.xp_reward, pm.rep_reward, req.user.profile_id]);

    // If achievement attached, unlock it
    if (pm.achievement_id) {
      await query(`
        INSERT INTO player_achievements (profile_id, achievement_id)
        VALUES ($1, $2)
        ON CONFLICT (profile_id, achievement_id) DO NOTHING;
      `, [req.user.profile_id, pm.achievement_id]);
    }

    return res.json({
      success: true,
      message: `Reward claimed! +${pm.xp_reward} XP, +${pm.rep_reward} Reputation, and ₡${rewardCredits.toFixed(2)} Credits!`,
      xpEarned: pm.xp_reward,
      creditsEarned: rewardCredits
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to claim reward: ' + err.message });
  }
});

export default router;

