import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { deductFunds } from '../services/economy.service.js';

const router = express.Router();

/**
 * List Education Institutions & Degree Programs
 */
router.get('/institutions', authenticate, requireCharacter, async (req, res) => {
  try {
    const instRes = await query(`
      SELECT ei.*, ci.name AS city_name
      FROM education_institutions ei
      JOIN cities ci ON ci.id = ei.city_id
      ORDER BY ei.reputation DESC;
    `);

    // Fetch user current enrollments
    const enrollRes = await query(`
      SELECT e.*, ei.name AS institution_name
      FROM enrollments e
      JOIN education_institutions ei ON ei.id = e.institution_id
      WHERE e.profile_id = $1;
    `, [req.user.profile_id]);

    return res.json({
      institutions: instRes.rows,
      enrollments: enrollRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch education academies.' });
  }
});

/**
 * Enroll in University / Academy
 */
router.post('/enroll', authenticate, requireCharacter, async (req, res) => {
  try {
    const { institutionId, programName } = req.body;
    const instId = parseInt(institutionId, 10);

    const instCheck = await query('SELECT * FROM education_institutions WHERE id = $1;', [instId]);
    if (instCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Academy not found.' });
    }
    const academy = instCheck.rows[0];
    const tuition = parseFloat(academy.tuition_fee);

    // Check if already actively enrolled
    const activeCheck = await query(`
      SELECT id FROM enrollments 
      WHERE profile_id = $1 AND institution_id = $2 AND status = 'enrolled';
    `, [req.user.profile_id, instId]);

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already enrolled in this academy.' });
    }

    // Deduct tuition if greater than 0
    if (tuition > 0) {
      await deductFunds({
        planetId: req.user.planet_id || 1,
        fromProfileId: req.user.profile_id,
        amount: tuition,
        transactionType: 'tuition',
        description: `Tuition payment for ${academy.name}`
      });
    }

    // Record enrollment
    const newEnrollRes = await query(`
      INSERT INTO enrollments (profile_id, institution_id, program_name, status, grade_average)
      VALUES ($1, $2, $3, 'enrolled', 85.00)
      RETURNING *;
    `, [req.user.profile_id, instId, programName || 'Bachelor of Quantum Sciences']);

    // Update mission progress if active
    await query(`
      UPDATE player_missions 
      SET progress = progress + 1 
      WHERE profile_id = $1 AND status = 'active' AND mission_id IN (
        SELECT id FROM missions WHERE requirements->>'type' = 'enroll'
      );
    `, [req.user.profile_id]).catch(() => {});

    return res.json({
      success: true,
      message: `Enrolled in ${academy.name}!`,
      enrollment: newEnrollRes.rows[0]
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Complete Study Session / Exam (Boosts Skills and Grades)
 */
router.post('/study', authenticate, requireCharacter, async (req, res) => {
  try {
    const { enrollmentId, skillName = 'Quantum Programming' } = req.body;

    const enrollRes = await query(`
      SELECT * FROM enrollments 
      WHERE id = $1 AND profile_id = $2 AND status = 'enrolled';
    `, [enrollIdFromInt(enrollmentId), req.user.profile_id]);

    function enrollIdFromInt(val) {
      return parseInt(val, 10);
    }

    if (enrollRes.rows.length === 0) {
      return res.status(404).json({ error: 'Active enrollment not found.' });
    }

    // Lookup skill
    let skillRes = await query('SELECT id FROM skills WHERE name = $1 LIMIT 1;', [skillName]);
    if (skillRes.rows.length === 0) {
      skillRes = await query('SELECT id FROM skills LIMIT 1;');
    }
    const skillId = skillRes.rows[0].id;

    // Award XP to skill
    await query(`
      INSERT INTO player_skills (profile_id, skill_id, level, current_xp)
      VALUES ($1, $2, 1, 25)
      ON CONFLICT (profile_id, skill_id) DO UPDATE SET 
        current_xp = player_skills.current_xp + 25,
        level = CASE 
          WHEN player_skills.current_xp + 25 >= player_skills.level * 100 
          THEN player_skills.level + 1 
          ELSE player_skills.level 
        END,
        updated_at = CURRENT_TIMESTAMP;
    `, [req.user.profile_id, skillId]);

    // Improve grade average slightly
    await query(`
      UPDATE enrollments 
      SET grade_average = LEAST(grade_average + 1.25, 100.00) 
      WHERE id = $1;
    `, [enrollmentId]);

    return res.json({
      success: true,
      message: `Study session completed! +25 XP awarded to ${skillName}.`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Study session failed: ' + err.message });
  }
});

/**
 * Graduate / Earn Degree
 */
router.post('/graduate', authenticate, requireCharacter, async (req, res) => {
  try {
    const { enrollmentId } = req.body;
    const enrollRes = await query(`
      SELECT e.*, ei.name AS academy_name 
      FROM enrollments e
      JOIN education_institutions ei ON ei.id = e.institution_id
      WHERE e.id = $1 AND e.profile_id = $2 AND e.status = 'enrolled';
    `, [enrollmentId, req.user.profile_id]);

    if (enrollRes.rows.length === 0) {
      return res.status(404).json({ error: 'Active enrollment not found.' });
    }

    const enrollment = enrollRes.rows[0];
    if (parseFloat(enrollment.grade_average) < 70) {
      return res.status(400).json({ error: 'Grade average must be at least 70.0% to graduate. Study more!' });
    }

    await query(`
      UPDATE enrollments 
      SET status = 'graduated', completed_at = CURRENT_TIMESTAMP 
      WHERE id = $1;
    `, [enrollmentId]);

    // Boost player character intellect & XP
    await query(`
      UPDATE player_profiles 
      SET experience_points = experience_points + 300, level = level + 1 
      WHERE id = $1;
    `, [req.user.profile_id]);

    return res.json({
      success: true,
      message: `Congratulations! You have graduated from ${enrollment.academy_name} with honors! +300 XP and Level Up!`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Graduation failed.' });
  }
});

export default router;

