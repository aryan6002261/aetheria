import express from 'express';
import { query } from '../db/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { generateNewspaperArticle } from '../services/ai.service.js';

const router = express.Router();

/**
 * Get Planetary Historical Timeline Archive
 */
router.get('/timeline', optionalAuth, async (req, res) => {
  try {
    const planetId = req.query.planetId ? parseInt(req.query.planetId, 10) : 1;

    const historyRes = await query(`
      SELECT * FROM historical_records
      WHERE planet_id = $1
      ORDER BY world_year DESC, world_day DESC, id DESC
      LIMIT 50;
    `, [planetId]);

    const planetRes = await query('SELECT name, world_year, world_day, timeline_status FROM planets WHERE id = $1;', [planetId]);

    return res.json({
      planet: planetRes.rows[0] || {},
      timeline: historyRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch timeline: ' + err.message });
  }
});

/**
 * Get The Veridian Chronicle (AI Newspaper Grounded in Real DB Events)
 */
router.get('/newspaper', optionalAuth, async (req, res) => {
  try {
    const planetId = req.query.planetId ? parseInt(req.query.planetId, 10) : 1;

    const planetRes = await query('SELECT name, world_year, world_day FROM planets WHERE id = $1;', [planetId]);
    const planetName = planetRes.rows[0]?.name || 'Aethel';

    // Fetch actual recent database events
    const recentRecords = await query(`
      SELECT category, headline, article, world_year, world_day 
      FROM historical_records 
      WHERE planet_id = $1 
      ORDER BY id DESC 
      LIMIT 8;
    `, [planetId]);

    const article = await generateNewspaperArticle({
      events: recentRecords.rows,
      planetName
    });

    return res.json({
      newspaper: `The ${planetName} Gazette`,
      editor: 'Evelyn Miller',
      worldYear: planetRes.rows[0]?.world_year || 2026,
      worldDay: planetRes.rows[0]?.world_day || 1,
      ...article,
      recentEvents: recentRecords.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate newspaper: ' + err.message });
  }
});

export default router;

