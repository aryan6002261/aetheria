import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query } from '../db/db.js';

export function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.aetheria_token) {
      token = req.cookies.aetheria_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No session token provided.' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    // Verify user still exists in PostgreSQL database
    const userRes = await query(`
      SELECT u.id, u.email, u.display_name, u.role, u.is_active,
             p.id AS profile_id, p.character_name, p.username, p.planet_id, p.country_id, p.city_id, p.level
      FROM users u
      LEFT JOIN player_profiles p ON p.user_id = u.id
      WHERE u.id = $1;
    `, [decoded.userId]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(401).json({ error: 'User account does not exist or has been suspended.' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireCharacter(req, res, next) {
  if (!req.user || !req.user.profile_id) {
    return res.status(403).json({ 
      error: 'Character creation required.',
      code: 'CHARACTER_REQUIRED',
      redirect: '/character-create.html'
    });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }
  next();
}

export async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.aetheria_token || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      const userRes = await query(`
        SELECT u.id, u.email, u.display_name, u.role, u.is_active,
               p.id AS profile_id, p.character_name, p.username, p.planet_id, p.country_id, p.city_id, p.level
        FROM users u
        LEFT JOIN player_profiles p ON p.user_id = u.id
        WHERE u.id = $1;
      `, [decoded.userId]);
      if (userRes.rows.length > 0 && userRes.rows[0].is_active) {
        req.user = userRes.rows[0];
      }
    }
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
}

export default {
  generateToken,
  authenticate,
  requireCharacter,
  requireAdmin,
  optionalAuth,
};

