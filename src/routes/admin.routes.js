import express from 'express';
import { query } from '../db/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// Apply auth + requireAdmin to all routes in this file
router.use(authenticate, requireAdmin);

/**
 * System Overview & Economy Telemetry
 */
router.get('/overview', async (req, res) => {
  try {
    const usersCount = await query('SELECT COUNT(*) FROM users;');
    const profilesCount = await query('SELECT COUNT(*) FROM player_profiles;');
    const onlineCount = await query('SELECT COUNT(*) FROM player_profiles WHERE is_online = TRUE;');
    const moneySupply = await query('SELECT COALESCE(SUM(balance), 0) AS total_supply FROM wallets;');
    const txVolume = await query('SELECT COALESCE(SUM(amount), 0) AS total_volume, COUNT(*) AS tx_count FROM transactions;');
    const pendingReports = await query("SELECT COUNT(*) FROM reports WHERE status = 'pending';");

    return res.json({
      totalUsers: parseInt(usersCount.rows[0].count, 10),
      totalProfiles: parseInt(profilesCount.rows[0].count, 10),
      onlineCitizens: parseInt(onlineCount.rows[0].count, 10),
      totalMoneySupply: parseFloat(moneySupply.rows[0].total_supply),
      totalTransactionVolume: parseFloat(txVolume.rows[0].total_volume),
      transactionCount: parseInt(txVolume.rows[0].tx_count, 10),
      pendingReportsCount: parseInt(pendingReports.rows[0].count, 10)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin overview: ' + err.message });
  }
});

/**
 * Manage Users List
 */
router.get('/users', async (req, res) => {
  try {
    const usersRes = await query(`
      SELECT u.id, u.email, u.display_name, u.role, u.is_active, u.created_at,
             p.id AS profile_id, p.character_name, p.username, p.level, p.reputation,
             w.balance AS wallet_balance
      FROM users u
      LEFT JOIN player_profiles p ON p.user_id = u.id
      LEFT JOIN wallets w ON w.profile_id = p.id
      ORDER BY u.id DESC
      LIMIT 100;
    `);

    return res.json({ users: usersRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

/**
 * Suspend / Ban or Restore User Account
 */
router.post('/users/:id/status', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { isActive, reason } = req.body;

    await query('UPDATE users SET is_active = $1 WHERE id = $2;', [isActive, userId]);

    if (!isActive) {
      await query(`
        INSERT INTO moderation_actions (admin_user_id, target_user_id, action_type, reason)
        VALUES ($1, $2, 'suspension', $3);
      `, [req.user.id, userId, reason || 'Administrative action']);
    }

    await logAudit({
      userId: req.user.id,
      action: isActive ? 'RESTORE_USER' : 'SUSPEND_USER',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      metadata: { reason }
    });

    return res.json({ success: true, message: `User status set to ${isActive ? 'active' : 'suspended'}.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

/**
 * Review Reports
 */
router.get('/reports', async (req, res) => {
  try {
    const reportsRes = await query(`
      SELECT r.*, 
             p_rep.character_name AS reporter_name,
             p_tar.character_name AS reported_name
      FROM reports r
      JOIN player_profiles p_rep ON p_rep.id = r.reporter_profile_id
      JOIN player_profiles p_tar ON p_tar.id = r.reported_profile_id
      ORDER BY r.created_at DESC;
    `);

    return res.json({ reports: reportsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

/**
 * Resolve Report
 */
router.post('/reports/:id/resolve', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { status = 'resolved' } = req.body;

    await query('UPDATE reports SET status = $1 WHERE id = $2;', [status, reportId]);

    return res.json({ success: true, message: `Report marked as ${status}.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update report status.' });
  }
});

/**
 * Inspect Immutable Audit Logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logsRes = await query(`
      SELECT al.*, u.email, p.character_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN player_profiles p ON p.id = al.profile_id
      ORDER BY al.created_at DESC
      LIMIT 100;
    `);

    return res.json({ logs: logsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

/**
 * Trigger Planetary World Event
 */
router.post('/world-event', async (req, res) => {
  try {
    const { title, description, eventType = 'economic', severity = 'normal' } = req.body;

    const eventRes = await query(`
      INSERT INTO world_events (planet_id, title, description, event_type, severity)
      VALUES (1, $1, $2, $3, $4)
      RETURNING *;
    `, [title, description, eventType, severity]);

    // Also record in history
    await query(`
      INSERT INTO historical_records (planet_id, world_year, world_day, category, headline, article)
      VALUES (1, 2185, (SELECT world_day FROM planets WHERE id = 1), $1, $2, $3);
    `, [eventType, title, description]);

    return res.json({ success: true, message: 'World event triggered and published!', event: eventRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to trigger world event.' });
  }
});

export default router;

