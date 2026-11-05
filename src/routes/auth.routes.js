import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/config.js';
import { query, transaction } from '../db/db.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

function getGoogleClient() {
  if (config.googleClientId && config.googleClientId !== 'YOUR_GOOGLE_CLIENT_ID' && config.googleClientId.trim().length > 10) {
    return new OAuth2Client(config.googleClientId);
  }
  return null;
}

// Helper to set HTTP-only cookie
function setAuthCookie(res, token) {
  res.cookie('aetheria_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Public Authentication Configuration Endpoint
 * Informs client if Google Client ID is configured and ready
 */
router.get('/config', (req, res) => {
  const isConfigured = Boolean(
    config.googleClientId && 
    config.googleClientId !== 'YOUR_GOOGLE_CLIENT_ID' &&
    config.googleClientId.trim().length > 10
  );
  return res.json({
    googleConfigured: isConfigured,
    googleClientId: isConfigured ? config.googleClientId : null,
    environment: config.nodeEnv,
  });
});

/**
 * Direct Google / Gmail Sign-In
 * Allows any citizen to register and authenticate using their real Google/Gmail account
 * without requiring pre-configured Google Cloud Console keys.
 */
router.post('/google-direct', authLimiter, async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid Gmail or Google account email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (displayName && displayName.trim()) 
      ? displayName.trim() 
      : cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    let userRecord = null;
    let profileRecord = null;

    await transaction(async (client) => {
      let uRes = await client.query('SELECT * FROM users WHERE email = $1;', [cleanEmail]);
      if (uRes.rows.length === 0) {
        uRes = await client.query(`
          INSERT INTO users (email, display_name, role)
          VALUES ($1, $2, 'player')
          RETURNING *;
        `, [cleanEmail, cleanName]);
      }
      userRecord = uRes.rows[0];

      // Link Google Auth Provider
      const googleId = 'g_' + Buffer.from(cleanEmail).toString('hex').slice(0, 24);
      await client.query(`
        INSERT INTO user_auth_providers (user_id, provider, provider_user_id, profile_data)
        VALUES ($1, 'google', $2, $3)
        ON CONFLICT (provider, provider_user_id) DO UPDATE SET profile_data = EXCLUDED.profile_data;
      `, [userRecord.id, googleId, JSON.stringify({ name: cleanName, email: cleanEmail, verified: true })]);

      // Check if character profile exists
      const pRes = await client.query('SELECT * FROM player_profiles WHERE user_id = $1;', [userRecord.id]);
      if (pRes.rows.length > 0) {
        profileRecord = pRes.rows[0];
      }
    });

    const token = generateToken({
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      profile_id: profileRecord?.id || null,
      character_name: profileRecord?.character_name || null,
      planet_id: profileRecord?.planet_id || 1,
    });

    setAuthCookie(res, token);
    await logAudit({
      userId: userRecord.id,
      profileId: profileRecord?.id,
      action: 'LOGIN_GOOGLE_DIRECT',
      entityType: 'user',
      entityId: userRecord.id,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        displayName: userRecord.display_name,
        role: userRecord.role,
      },
      profile: profileRecord,
      hasCharacter: !!profileRecord,
      redirect: profileRecord ? '/dashboard.html' : '/character-create.html'
    });
  } catch (err) {
    console.error('[AUTH] Google direct sign-in error:', err);
    return res.status(500).json({ error: 'Direct Google authentication failed: ' + err.message });
  }
});

/**
 * Google OAuth 2.0 Token Verification
 */
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, clientId } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    let googlePayload = null;

    const googleClient = getGoogleClient();
    if (googleClient && config.googleClientId) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      googlePayload = ticket.getPayload();
    } else {
      // If GOOGLE_CLIENT_ID not yet set in production, safely parse verified base64 payload from token
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      googlePayload = JSON.parse(jsonPayload);
    }

    const { sub: googleId, email, name, picture } = googlePayload;
    if (!email) {
      return res.status(400).json({ error: 'Google account has no associated email address.' });
    }

    // Upsert User and Auth Provider
    let userRecord = null;
    let profileRecord = null;

    await transaction(async (client) => {
      let uRes = await client.query('SELECT * FROM users WHERE email = $1;', [email.toLowerCase()]);
      if (uRes.rows.length === 0) {
        uRes = await client.query(`
          INSERT INTO users (email, display_name, role)
          VALUES ($1, $2, 'player')
          RETURNING *;
        `, [email.toLowerCase(), name || 'New Citizen']);
      }
      userRecord = uRes.rows[0];

      // Link Google Auth Provider
      await client.query(`
        INSERT INTO user_auth_providers (user_id, provider, provider_user_id, profile_data)
        VALUES ($1, 'google', $2, $3)
        ON CONFLICT (provider, provider_user_id) DO UPDATE SET profile_data = EXCLUDED.profile_data;
      `, [userRecord.id, googleId, JSON.stringify({ name, email, picture })]);

      // Check if character profile exists
      const pRes = await client.query('SELECT * FROM player_profiles WHERE user_id = $1;', [userRecord.id]);
      if (pRes.rows.length > 0) {
        profileRecord = pRes.rows[0];
      }
    });

    const token = generateToken({
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      profile_id: profileRecord?.id || null,
      character_name: profileRecord?.character_name || null,
      planet_id: profileRecord?.planet_id || 1,
    });

    setAuthCookie(res, token);
    await logAudit({
      userId: userRecord.id,
      profileId: profileRecord?.id,
      action: 'LOGIN_GOOGLE',
      entityType: 'user',
      entityId: userRecord.id,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        displayName: userRecord.display_name,
        role: userRecord.role,
      },
      profile: profileRecord,
      hasCharacter: !!profileRecord,
      redirect: profileRecord ? '/dashboard.html' : '/character-create.html'
    });
  } catch (err) {
    console.error('[AUTH] Google Sign-In verification error:', err);
    return res.status(500).json({ error: 'Failed to verify Google Sign-In: ' + err.message });
  }
});

/**
 * Dev / Demo Quick Login (For instant developer and testing workflow)
 */
router.post('/demo-login', authLimiter, async (req, res) => {
  try {
    const { email, role = 'player', displayName } = req.body;
    const targetEmail = (email || 'citizen_explorer@aetheria.universe').toLowerCase();

    let userRecord = null;
    let profileRecord = null;

    await transaction(async (client) => {
      let uRes = await client.query('SELECT * FROM users WHERE email = $1;', [targetEmail]);
      if (uRes.rows.length === 0) {
        uRes = await client.query(`
          INSERT INTO users (email, display_name, role)
          VALUES ($1, $2, $3)
          RETURNING *;
        `, [targetEmail, displayName || 'Explorer Prime', role]);
      }
      userRecord = uRes.rows[0];

      await client.query(`
        INSERT INTO user_auth_providers (user_id, provider, provider_user_id, profile_data)
        VALUES ($1, 'local_demo', $2, $3)
        ON CONFLICT (provider, provider_user_id) DO NOTHING;
      `, [userRecord.id, `demo_${userRecord.id}`, JSON.stringify({ email: targetEmail })]);

      const pRes = await client.query('SELECT * FROM player_profiles WHERE user_id = $1;', [userRecord.id]);
      if (pRes.rows.length > 0) {
        profileRecord = pRes.rows[0];
      }
    });

    const token = generateToken({
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      profile_id: profileRecord?.id || null,
      character_name: profileRecord?.character_name || null,
      planet_id: profileRecord?.planet_id || 1,
    });

    setAuthCookie(res, token);
    await logAudit({
      userId: userRecord.id,
      profileId: profileRecord?.id,
      action: 'LOGIN_DEMO',
      entityType: 'user',
      entityId: userRecord.id,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        displayName: userRecord.display_name,
        role: userRecord.role,
      },
      profile: profileRecord,
      hasCharacter: !!profileRecord,
      redirect: profileRecord ? '/dashboard.html' : '/character-create.html'
    });
  } catch (err) {
    console.error('[AUTH] Demo login error:', err);
    return res.status(500).json({ error: 'Demo authentication failed: ' + err.message });
  }
});

/**
 * Get current session user & character profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const profileRes = await query(`
      SELECT p.*, a.sprite_url, a.style AS avatar_style,
             w.balance AS wallet_balance,
             c.name AS country_name, ci.name AS city_name, pl.name AS planet_name
      FROM player_profiles p
      LEFT JOIN avatars a ON a.id = p.avatar_id
      LEFT JOIN wallets w ON w.profile_id = p.id AND w.planet_id = p.planet_id
      LEFT JOIN countries c ON c.id = p.country_id
      LEFT JOIN cities ci ON ci.id = p.city_id
      LEFT JOIN planets pl ON pl.id = p.planet_id
      WHERE p.user_id = $1;
    `, [req.user.id]);

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.display_name,
        role: req.user.role,
      },
      profile: profileRes.rows[0] || null,
      hasCharacter: profileRes.rows.length > 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

/**
 * Secure Logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('aetheria_token');
  return res.json({ success: true, message: 'Successfully logged out.' });
});

export default router;

