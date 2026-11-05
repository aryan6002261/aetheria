import express from 'express';
import { query } from '../db/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get Universe Hierarchy & Known Planets
 */
router.get('/universe', optionalAuth, async (req, res) => {
  try {
    const galaxiesRes = await query('SELECT * FROM galaxies;');
    const planetsRes = await query(`
      SELECT p.*, g.name AS galaxy_name,
             (SELECT COUNT(*) FROM countries c WHERE c.planet_id = p.id) AS countries_count,
             (SELECT COUNT(*) FROM player_profiles prof WHERE prof.planet_id = p.id) AS citizen_count
      FROM planets p
      JOIN galaxies g ON g.id = p.galaxy_id
      ORDER BY p.id ASC;
    `);

    return res.json({
      galaxies: galaxiesRes.rows,
      planets: planetsRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch universe hierarchy.' });
  }
});

/**
 * Get Detailed Planet Explorer Telemetry
 */
router.get('/planet/:id', optionalAuth, async (req, res) => {
  try {
    const planetId = parseInt(req.params.id, 10);
    const planetRes = await query(`
      SELECT p.*, g.name AS galaxy_name
      FROM planets p
      JOIN galaxies g ON g.id = p.galaxy_id
      WHERE p.id = $1;
    `, [planetId]);

    if (planetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Planet not found.' });
    }

    const countriesRes = await query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM cities ci WHERE ci.country_id = c.id) AS cities_count
      FROM countries c
      WHERE c.planet_id = $1 AND c.is_active = TRUE;
    `, [planetId]);

    return res.json({
      planet: planetRes.rows[0],
      countries: countriesRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch planet details.' });
  }
});

/**
 * Get Cities & Communities for a Country
 */
router.get('/country/:id', optionalAuth, async (req, res) => {
  try {
    const countryId = parseInt(req.params.id, 10);
    const countryRes = await query('SELECT * FROM countries WHERE id = $1;', [countryId]);
    if (countryRes.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found.' });
    }

    const citiesRes = await query(`
      SELECT ci.*, r.name AS region_name,
             (SELECT COUNT(*) FROM communities co WHERE co.city_id = ci.id) AS communities_count
      FROM cities ci
      JOIN regions r ON r.id = ci.region_id
      WHERE ci.country_id = $1;
    `, [countryId]);

    return res.json({
      country: countryRes.rows[0],
      cities: citiesRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch country details.' });
  }
});

/**
 * Interplanetary Discovery / Exploration Expedition (Section 3 & 15)
 */
router.post('/discover', authenticate, async (req, res) => {
  try {
    const { expeditionType = 'orbital_scan' } = req.body;

    // Check if undiscovered planet exists or generate an exploration discovery log
    const undiscoveredRes = await query('SELECT id, name FROM planets WHERE is_discovered = FALSE LIMIT 1;');
    if (undiscoveredRes.rows.length > 0) {
      const targetPlanet = undiscoveredRes.rows[0];
      await query(`
        UPDATE planets 
        SET is_discovered = TRUE, discovery_date = CURRENT_TIMESTAMP 
        WHERE id = $1;
      `, [targetPlanet.id]);

      await query(`
        INSERT INTO discoveries (planet_id, discovery_type, title, description, discovered_by_profile_id)
        VALUES ($1, 'interplanetary', $2, $3, $4);
      `, [
        targetPlanet.id,
        `Discovery of Planet ${targetPlanet.name}`,
        `Citizen ${req.user.character_name} unlocked deep space telemetry channels to ${targetPlanet.name}!`,
        req.user.profile_id
      ]);

      return res.json({
        success: true,
        discoveryType: 'new_planet',
        message: `MAJOR EVENT! You have established contact with a new planet: ${targetPlanet.name}!`
      });
    }

    // Record technological / orbital discovery
    const scanDiscoveries = [
      'Subsurface geothermal crystal reservoirs located in the Solaris Basin.',
      'Harmonic resonance beacon detected orbiting the outer moon.',
      'Unmapped ancient subterranean archives uncovered beneath the mountain rim.',
      'Rare helium-3 isotope pocket charted in the upper atmosphere.'
    ];

    const finding = scanDiscoveries[Math.floor(Math.random() * scanDiscoveries.length)];

    await query(`
      INSERT INTO discoveries (planet_id, discovery_type, title, description, discovered_by_profile_id)
      VALUES ($1, 'exploration', 'Orbital Cartography Record', $2, $3);
    `, [req.user.planet_id || 1, finding, req.user.profile_id]);

    return res.json({
      success: true,
      discoveryType: 'cartography',
      finding,
      message: `Expedition complete: ${finding}`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Expedition failed: ' + err.message });
  }
});

export default router;

