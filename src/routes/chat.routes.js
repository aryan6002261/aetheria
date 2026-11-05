import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get Available Chat Channels (Global, Planet, Cities)
 */
router.get('/channels', authenticate, requireCharacter, async (req, res) => {
  try {
    const planetId = req.user.planet_id || 1;

    const channelsRes = await query(`
      SELECT * FROM conversations 
      WHERE planet_id = $1 AND type = 'channel'
      ORDER BY id ASC;
    `, [planetId]);

    const citiesRes = await query(`
      SELECT id, name FROM cities WHERE country_id = $1;
    `, [req.user.country_id || 1]);

    return res.json({
      channels: channelsRes.rows,
      cities: citiesRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chat channels.' });
  }
});

/**
 * Get Conversation Message History (Paginated)
 */
router.get('/messages/:conversationId', authenticate, requireCharacter, async (req, res) => {
  try {
    const convId = parseInt(req.params.conversationId, 10);
    const limit = parseInt(req.query.limit || '50', 10);

    const msgRes = await query(`
      SELECT m.*, a.sprite_url
      FROM messages m
      LEFT JOIN player_profiles p ON p.id = m.sender_profile_id
      LEFT JOIN avatars a ON a.id = p.avatar_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2;
    `, [convId, limit]);

    return res.json({ messages: msgRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load conversation history.' });
  }
});

/**
 * Get or Start Direct Message Conversation between 2 Citizens
 */
router.post('/direct/:recipientProfileId', authenticate, requireCharacter, async (req, res) => {
  try {
    const recipientId = parseInt(req.params.recipientProfileId, 10);
    const myId = req.user.profile_id;

    if (recipientId === myId) {
      return res.status(400).json({ error: 'Cannot open direct message channel with yourself.' });
    }

    // Check if DM conversation already exists
    const checkRes = await query(`
      SELECT c.id 
      FROM conversations c
      JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.profile_id = $1
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.profile_id = $2
      WHERE c.type = 'direct'
      LIMIT 1;
    `, [myId, recipientId]);

    if (checkRes.rows.length > 0) {
      return res.json({ conversationId: checkRes.rows[0].id });
    }

    // Fetch recipient name
    const recRes = await query('SELECT character_name FROM player_profiles WHERE id = $1;', [recipientId]);
    const recName = recRes.rows[0]?.character_name || 'Citizen';

    let conversationId = null;
    await transaction(async (client) => {
      const convRes = await client.query(`
        INSERT INTO conversations (type, title, planet_id)
        VALUES ('direct', $1, $2)
        RETURNING id;
      `, [`DM: ${req.user.character_name} & ${recName}`, req.user.planet_id || 1]);
      conversationId = convRes.rows[0].id;

      await client.query(`
        INSERT INTO conversation_members (conversation_id, profile_id, role)
        VALUES ($1, $2, 'member'), ($1, $3, 'member');
      `, [conversationId, myId, recipientId]);
    });

    return res.json({ conversationId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create direct message conversation.' });
  }
});

/**
 * List Lounges (Public and Private)
 */
router.get('/lounges', authenticate, requireCharacter, async (req, res) => {
  try {
    const planetId = req.user.planet_id || 1;
    const loungesRes = await query(`
      SELECT l.*, ci.name AS city_name
      FROM lounges l
      LEFT JOIN cities ci ON ci.id = l.city_id
      WHERE l.planet_id = $1
      ORDER BY l.created_at ASC;
    `, [planetId]);

    return res.json({ lounges: loungesRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch lounges.' });
  }
});

/**
 * Create Lounge
 */
router.post('/lounges/create', authenticate, requireCharacter, async (req, res) => {
  try {
    const { name, category = 'Cyber Lounge', description, isPrivate = false, passCode, cityId } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Lounge name is required.' });
    }

    const insertRes = await query(`
      INSERT INTO lounges (planet_id, city_id, name, category, description, is_private, pass_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [
      req.user.planet_id || 1,
      cityId || req.user.city_id || 1,
      name.trim(),
      category,
      description || 'A cozy space for citizens.',
      isPrivate,
      passCode || null
    ]);

    return res.status(201).json({ success: true, lounge: insertRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create lounge: ' + err.message });
  }
});

export default router;

