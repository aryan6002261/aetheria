import { query } from '../db/db.js';

export async function logAudit({
  userId = null,
  profileId = null,
  action,
  entityType,
  entityId = null,
  ipAddress = null,
  metadata = {}
}) {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, profile_id, action, entity_type, entity_id, ip_address, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `, [
      userId,
      profileId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      ipAddress,
      JSON.stringify(metadata)
    ]);
  } catch (err) {
    console.error('[AUDIT] Failed to record audit log:', err.message);
  }
}

export function auditMiddleware(action, entityType) {
  return async (req, res, next) => {
    // Execute request first
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        await logAudit({
          userId: req.user?.id || null,
          profileId: req.user?.profile_id || null,
          action,
          entityType,
          entityId: req.params?.id || req.body?.id || null,
          ipAddress: req.ip || req.connection?.remoteAddress,
          metadata: { path: req.originalUrl, method: req.method }
        });
      }
    });
    next();
  };
}

export default {
  logAudit,
  auditMiddleware,
};
