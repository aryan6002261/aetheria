import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { getAssistantHelp } from '../services/ai.service.js';

const router = express.Router();

/**
 * Ask AI Tutorial Assistant (ANI)
 */
router.post('/ask', optionalAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query prompt cannot be empty.' });
    }

    const playerContext = req.user ? {
      character_name: req.user.character_name,
      level: req.user.level,
      planet: 'Veridia Prime',
    } : {};

    const answer = await getAssistantHelp({
      query: query.trim(),
      playerContext
    });

    return res.json({
      success: true,
      assistantName: 'ANI (Aetheria Navigation Intelligence)',
      answer
    });
  } catch (err) {
    return res.status(500).json({ error: 'Assistant unavailable: ' + err.message });
  }
});

export default router;

