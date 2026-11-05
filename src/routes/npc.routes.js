import express from 'express';
import { query } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { generateNpcDialogue } from '../services/ai.service.js';

const router = express.Router();

/**
 * List Persistent AI NPCs
 */
router.get('/directory', authenticate, requireCharacter, async (req, res) => {
  try {
    const npcsRes = await query(`
      SELECT n.*, ci.name AS city_name
      FROM npc_characters n
      LEFT JOIN cities ci ON ci.id = n.city_id
      WHERE n.is_active = TRUE
      ORDER BY n.id ASC;
    `);

    return res.json({ npcs: npcsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch NPC directory.' });
  }
});

/**
 * Chat with a Persistent AI NPC (With Memory Continuity)
 */
router.post('/:id/chat', authenticate, requireCharacter, async (req, res) => {
  try {
    const npcId = parseInt(req.params.id, 10);
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const npcRes = await query('SELECT * FROM npc_characters WHERE id = $1;', [npcId]);
    if (npcRes.rows.length === 0) {
      return res.status(404).json({ error: 'NPC not found.' });
    }
    const npc = npcRes.rows[0];

    // Fetch past memories with this specific player
    const memoriesRes = await query(`
      SELECT memory_type, context, emotional_impact, created_at 
      FROM npc_memories 
      WHERE npc_id = $1 AND profile_id = $2 
      ORDER BY created_at DESC 
      LIMIT 5;
    `, [npcId, req.user.profile_id]);

    // Generate in-character response via AI service
    const dialogueResult = await generateNpcDialogue({
      npc,
      player: req.user,
      message: message.trim(),
      memories: memoriesRes.rows
    });

    // Store new memory in database
    await query(`
      INSERT INTO npc_memories (npc_id, profile_id, memory_type, context, emotional_impact)
      VALUES ($1, $2, 'conversation', $3, $4);
    `, [npcId, req.user.profile_id, dialogueResult.newMemory, dialogueResult.emotionalImpact]);

    // Update affinity in relationship table
    await query(`
      INSERT INTO npc_relationships (npc_id, profile_id, relationship_type, affinity, trust)
      VALUES ($1, $2, 'Acquaintance', 55, 52)
      ON CONFLICT (npc_id, profile_id) DO UPDATE SET 
        affinity = LEAST(npc_relationships.affinity + 2, 100),
        trust = LEAST(npc_relationships.trust + 1, 100),
        updated_at = CURRENT_TIMESTAMP;
    `, [npcId, req.user.profile_id]);

    return res.json({
      success: true,
      npc: {
        id: npc.id,
        name: npc.name,
        occupation: npc.occupation,
        avatar_url: npc.avatar_url,
      },
      reply: dialogueResult.reply,
      newMemory: dialogueResult.newMemory
    });
  } catch (err) {
    console.error('[NPC] Chat error:', err);
    return res.status(500).json({ error: 'Failed to communicate with NPC: ' + err.message });
  }
});

export default router;
