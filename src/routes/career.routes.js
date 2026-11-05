import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { grantFunds } from '../services/economy.service.js';

const router = express.Router();

/**
 * Get Available Job Openings & Current Employment Status
 */
router.get('/jobs', authenticate, requireCharacter, async (req, res) => {
  try {
    const jobsRes = await query(`
      SELECT j.*, c.name AS country_name
      FROM jobs j
      JOIN countries c ON c.id = j.country_id
      ORDER BY j.base_salary ASC;
    `);

    const currentEmpRes = await query(`
      SELECT e.*, j.title, j.category, j.icon
      FROM employment e
      JOIN jobs j ON j.id = e.job_id
      WHERE e.profile_id = $1 AND e.status = 'active';
    `, [req.user.profile_id]);

    return res.json({
      jobs: jobsRes.rows,
      currentEmployment: currentEmpRes.rows[0] || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch job market.' });
  }
});

/**
 * Apply for a Career Position
 */
router.post('/apply', authenticate, requireCharacter, async (req, res) => {
  try {
    const { jobId } = req.body;
    const jId = parseInt(jobId, 10);

    const jobCheck = await query('SELECT * FROM jobs WHERE id = $1;', [jId]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job position not found.' });
    }
    const job = jobCheck.rows[0];

    // Resign from existing active employment if any
    await query(`
      UPDATE employment 
      SET status = 'resigned', ended_at = CURRENT_TIMESTAMP 
      WHERE profile_id = $1 AND status = 'active';
    `, [req.user.profile_id]);

    // Create new employment record
    const empRes = await query(`
      INSERT INTO employment (profile_id, job_id, status, salary, performance)
      VALUES ($1, $2, 'active', $3, 80)
      RETURNING *;
    `, [req.user.profile_id, jId, job.base_salary]);

    // Update mission progress if active
    await query(`
      UPDATE player_missions 
      SET progress = progress + 1 
      WHERE profile_id = $1 AND status = 'active' AND mission_id IN (
        SELECT id FROM missions WHERE requirements->>'type' = 'job'
      );
    `, [req.user.profile_id]).catch(() => {});

    return res.json({
      success: true,
      message: `Congratulations! You have been hired as a ${job.title}!`,
      employment: empRes.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Job application failed: ' + err.message });
  }
});

/**
 * Work a Shift (Collect Salary with Tax Deduction)
 */
router.post('/work', authenticate, requireCharacter, async (req, res) => {
  try {
    const empRes = await query(`
      SELECT e.*, j.title, c.tax_rate, c.id AS country_id
      FROM employment e
      JOIN jobs j ON j.id = e.job_id
      JOIN countries c ON c.id = j.country_id
      WHERE e.profile_id = $1 AND e.status = 'active';
    `, [req.user.profile_id]);

    if (empRes.rows.length === 0) {
      return res.status(400).json({ error: 'You do not have an active job position. Apply first!' });
    }

    const emp = empRes.rows[0];
    const grossSalary = parseFloat(emp.salary);
    const taxRate = parseFloat(emp.tax_rate || 7.50) / 100;
    const taxAmount = grossSalary * taxRate;
    const netSalary = grossSalary - taxAmount;

    // Grant Net Salary to Player Wallet
    await grantFunds({
      planetId: req.user.planet_id || 1,
      toProfileId: req.user.profile_id,
      amount: netSalary,
      transactionType: 'salary',
      referenceType: 'job',
      referenceId: emp.job_id,
      description: `Shift payout for ${emp.title} (Gross: ₡${grossSalary.toFixed(2)}, Tax: ₡${taxAmount.toFixed(2)})`
    });

    // Credit tax to Country Treasury
    await query(`
      UPDATE countries 
      SET treasury_balance = treasury_balance + $1 
      WHERE id = $2;
    `, [taxAmount, emp.country_id]);

    // Boost performance & XP
    await query(`
      UPDATE employment 
      SET performance = LEAST(performance + 2, 100) 
      WHERE id = $1;
    `, [emp.id]);

    await query(`
      UPDATE player_profiles 
      SET experience_points = experience_points + 50 
      WHERE id = $1;
    `, [req.user.profile_id]);

    return res.json({
      success: true,
      message: `Shift completed! Earned net salary of ₡${netSalary.toFixed(2)} (Tax paid: ₡${taxAmount.toFixed(2)} to Neo-Arcadia treasury).`,
      grossSalary,
      taxAmount,
      netSalary
    });
  } catch (err) {
    return res.status(500).json({ error: 'Shift failed: ' + err.message });
  }
});

/**
 * Request Promotion
 */
router.post('/promote', authenticate, requireCharacter, async (req, res) => {
  try {
    const empRes = await query(`
      SELECT * FROM employment 
      WHERE profile_id = $1 AND status = 'active';
    `, [req.user.profile_id]);

    if (empRes.rows.length === 0) {
      return res.status(400).json({ error: 'No active employment.' });
    }

    const emp = empRes.rows[0];
    if (emp.performance < 90) {
      return res.status(400).json({ error: `Performance rating is ${emp.performance}/100. Must be 90+ for a promotion. Keep working!` });
    }

    const newSalary = parseFloat(emp.salary) * 1.25;
    await query(`
      UPDATE employment 
      SET salary = $1, performance = 75 
      WHERE id = $2;
    `, [newSalary, emp.id]);

    return res.json({
      success: true,
      message: `PROMOTION GRANTED! Your salary has been elevated to ₡${newSalary.toFixed(2)}/shift!`,
      newSalary
    });
  } catch (err) {
    return res.status(500).json({ error: 'Promotion review failed.' });
  }
});

export default router;
