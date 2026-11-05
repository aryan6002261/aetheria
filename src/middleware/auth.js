import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query } from '../db/db.js';

export function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

/**
 * Frictionless Authentication Middleware
 * If no session token is provided, automatically provisions/resumes a local citizen
 * identity so the user can immediately play without any login barrier.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.aetheria_token) {
      token = req.cookies.aetheria_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      // Auto-assign local citizen user for seamless single-player experience
      let uRes = await query('SELECT * FROM users ORDER BY id ASC LIMIT 1;');
      if (uRes.rows.length === 0) {
        uRes = await query(`
          INSERT INTO users (email, display_name, role)
          VALUES ('citizen@aethel.world', 'Local Citizen', 'player')
          RETURNING *;
        `);
      }
      const defaultUser = uRes.rows[0];

      const pRes = await query(`
        SELECT p.*, a.sprite_url, w.balance AS wallet_balance,
               c.name AS country_name, c.government_type, ci.name AS city_name
        FROM player_profiles p
        LEFT JOIN avatars a ON a.id = p.avatar_id
        LEFT JOIN wallets w ON w.profile_id = p.id
        LEFT JOIN countries c ON c.id = p.country_id
        LEFT JOIN cities ci ON ci.id = p.city_id
        WHERE p.user_id = $1
        ORDER BY p.id DESC LIMIT 1;
      `, [defaultUser.id]);

      const profile = pRes.rows[0] || null;

      const autoToken = generateToken({
        userId: defaultUser.id,
        email: defaultUser.email,
        role: defaultUser.role,
        profile_id: profile?.id || null,
        character_name: profile?.character_name || null,
        planet_id: profile?.planet_id || 1,
      });

      res.cookie('aetheria_token', autoToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      req.user = {
        id: defaultUser.id,
        email: defaultUser.email,
        display_name: defaultUser.display_name,
        role: defaultUser.role,
        profile_id: profile?.id || null,
        character_name: profile?.character_name || null,
        username: profile?.username || null,
        planet_id: profile?.planet_id || 1,
        country_id: profile?.country_id || 1,
        city_id: profile?.city_id || 1,
        level: profile?.level || 1,
      };

      return next();
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    const userRes = await query(`
      SELECT u.id, u.email, u.display_name, u.role, u.is_active,
             p.id AS profile_id, p.character_name, p.username, p.planet_id, p.country_id, p.city_id, p.level
      FROM users u
      LEFT JOIN player_profiles p ON p.user_id = u.id
      WHERE u.id = $1;
    `, [decoded.userId]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      // Re-provision if deleted
      res.clearCookie('aetheria_token');
      return authenticate(req, res, next);
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    // If token invalid, auto-heal
    res.clearCookie('aetheria_token');
    return authenticate(req, res, next);
  }
}

export function optionalAuth(req, res, next) {
  return authenticate(req, res, next);
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
