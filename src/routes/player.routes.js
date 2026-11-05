import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { generateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

/**
 * Generate randomized starting circumstances for Random Life Mode (Section 4)
 */
router.get('/random-preview', authenticate, async (req, res) => {
  try {
    const firstNames = ['Aria', 'Kaelen', 'Vesper', 'Cassian', 'Lyra', 'Dax', 'Seraphina', 'Ronan', 'Zephyr', 'Orion', 'Eleni', 'Thorne'];
    const lastNames = ['Voss', 'Solis', 'Mercer', 'Draken', 'Sinclair', 'Chronos', 'Nyx', 'Sterling', 'Valen', 'Cross'];
    const backgrounds = [
      'Descendant of early orbital station hydroponics engineers.',
      'Raised by an academic collective in the high towers of Aethel City.',
      'Child of pioneering space navigators who surveyed the binary flares.',
      'Grew up among the artisan workshops of the Cyber Promenade.',
      'Sponsored by a philanthropic planetary medical research foundation.'
    ];
    const wealthTiers = ['Modest Pioneer', 'Working Class', 'Established Guild Member', 'Comfortable Middle Class', 'Affluent Technologist'];

    const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const randomWealth = wealthTiers[Math.floor(Math.random() * wealthTiers.length)];

    // Fetch cities in default planet
    const citiesRes = await query('SELECT id, name FROM cities LIMIT 5;');
    const chosenCity = citiesRes.rows[Math.floor(Math.random() * citiesRes.rows.length)] || { id: 1, name: 'Aethel City' };

    // Initial stats
    const stats = {
      health: 85 + Math.floor(Math.random() * 15),
      energy: 85 + Math.floor(Math.random() * 15),
      happiness: 75 + Math.floor(Math.random() * 20),
      intellect: 40 + Math.floor(Math.random() * 30),
      charisma: 40 + Math.floor(Math.random() * 30),
      strength: 40 + Math.floor(Math.random() * 30),
    };

    return res.json({
      suggestedName: randomName,
      background: randomBg,
      wealthTier: randomWealth,
      cityId: chosenCity.id,
      cityName: chosenCity.name,
      suggestedStats: stats,
      rerollsRemaining: 3
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate random preview: ' + err.message });
  }
});

/**
 * Character Creation (Custom or Random Mode)
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const {
      characterName,
      username,
      gender = 'Non-binary',
      bio,
      birthMode = 'custom',
      avatarStyle = 'cyber_pixel',
      hair = 'neon_blue_bob',
      skin = 'tone_2',
      eyeColor = 'cyber_amber',
      clothing = 'titanium_jacket',
      selectedCityId
    } = req.body;

    if (!characterName || !username) {
      return res.status(400).json({ error: 'Character name and username are required.' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 25) {
      return res.status(400).json({ error: 'Username must be between 3 and 25 alphanumeric characters.' });
    }

    // Check if user already has a character
    const existingCheck = await query('SELECT id FROM player_profiles WHERE user_id = $1;', [req.user.id]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already has an active character.' });
    }

    // Check username collision
    const nameCheck = await query('SELECT id FROM player_profiles WHERE username = $1;', [cleanUsername]);
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken by another citizen.' });
    }

    let createdProfile = null;

    await transaction(async (client) => {
      // 1. Create Avatar
      const avatarRes = await client.query(`
        INSERT INTO avatars (style, hair, skin, eye_color, clothing, sprite_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `, [avatarStyle, hair, skin, eyeColor, clothing, `/img/avatars/${avatarStyle}.png`]);
      const avatarId = avatarRes.rows[0].id;

      // 2. Resolve planet, country, and city
      const planetRes = await client.query('SELECT id FROM planets WHERE is_discovered = TRUE LIMIT 1;');
      const planetId = planetRes.rows[0]?.id || 1;

      const cityRes = selectedCityId 
        ? await client.query('SELECT id, country_id FROM cities WHERE id = $1;', [selectedCityId])
        : await client.query('SELECT id, country_id FROM cities LIMIT 1;');

      const cityId = cityRes.rows[0]?.id || 1;
      const countryId = cityRes.rows[0]?.country_id || 1;

      // 3. Create Player Profile
      const profRes = await client.query(`
        INSERT INTO player_profiles (
          user_id, planet_id, country_id, city_id, character_name, username,
          avatar_id, gender, virtual_age, life_stage, bio, birth_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 19, 'Early Adulthood', $9, $10)
        RETURNING *;
      `, [
        req.user.id,
        planetId,
        countryId,
        cityId,
        characterName.trim(),
        cleanUsername,
        avatarId,
        gender,
        bio || 'New citizen of Aetheria.',
        birthMode
      ]);
      createdProfile = profRes.rows[0];

      // 4. Create Initial Character Stats
      await client.query(`
        INSERT INTO character_stats (profile_id, health, energy, happiness, intellect, charisma, strength)
        VALUES ($1, 100, 100, 85, 55, 50, 50);
      `, [createdProfile.id]);

      // 5. Initialize Planetary Wallet with Starter Grant
      await client.query(`
        INSERT INTO wallets (profile_id, planet_id, balance)
        VALUES ($1, $2, 500.00);
      `, [createdProfile.id, planetId]);

      // 6. Assign or link to a Family / Guardian
      // Look for a consenting player household first; otherwise create autonomous lineage
      const familyCheck = await client.query(`
        SELECT id FROM families 
        WHERE accepting_children = TRUE AND planet_id = $1 
        LIMIT 1;
      `, [planetId]);

      let familyId = familyCheck.rows[0]?.id;
      if (!familyId) {
        const newFam = await client.query(`
          INSERT INTO families (planet_id, country_id, family_name, wealth_tier)
          VALUES ($1, $2, $3, 'Autonomous Lineage')
          RETURNING id;
        `, [planetId, countryId, `${characterName.trim().split(' ').pop()} Household`]);
        familyId = newFam.rows[0].id;
      }

      await client.query(`
        INSERT INTO family_members (family_id, profile_id, role)
        VALUES ($1, $2, 'Independent Citizen');
      `, [familyId, createdProfile.id]);

      // 7. Seed Initial Primary Mission (Civic Induction)
      const primaryMissionRes = await client.query('SELECT id FROM missions WHERE category = $1 LIMIT 1;', ['Social']);
      if (primaryMissionRes.rows.length > 0) {
        await client.query(`
          INSERT INTO player_missions (profile_id, mission_id, progress, target, status)
          VALUES ($1, $2, 0, 1, 'active');
        `, [createdProfile.id, primaryMissionRes.rows[0].id]);
      }

      // 8. Unlock "Awakening on Veridia" Achievement
      const achRes = await client.query('SELECT id FROM achievements WHERE code = $1;', ['FIRST_STEP']);
      if (achRes.rows.length > 0) {
        await client.query(`
          INSERT INTO player_achievements (profile_id, achievement_id)
          VALUES ($1, $2);
        `, [createdProfile.id, achRes.rows[0].id]);
      }
    });

    // Generate updated JWT including profile information
    const token = generateToken({
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      profile_id: createdProfile.id,
      character_name: createdProfile.character_name,
      planet_id: createdProfile.planet_id,
    });

    res.cookie('aetheria_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAudit({
      userId: req.user.id,
      profileId: createdProfile.id,
      action: 'CHARACTER_CREATED',
      entityType: 'profile',
      entityId: createdProfile.id,
      ipAddress: req.ip,
      metadata: { birthMode, characterName }
    });

    return res.json({
      success: true,
      message: 'Character successfully instantiated into the universe!',
      profile: createdProfile,
      redirect: '/dashboard.html'
    });
  } catch (err) {
    console.error('[PLAYER] Creation error:', err);
    return res.status(500).json({ error: 'Failed to create character: ' + err.message });
  }
});

/**
 * Get Full Profile by ID or Username
 */
router.get('/profile/:identifier', authenticate, async (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);

    const queryStr = isNumeric
      ? 'SELECT p.*, a.sprite_url, a.style AS avatar_style, c.name AS country_name, ci.name AS city_name, pl.name AS planet_name, pl.currency_symbol FROM player_profiles p LEFT JOIN avatars a ON a.id = p.avatar_id LEFT JOIN countries c ON c.id = p.country_id LEFT JOIN cities ci ON ci.id = p.city_id LEFT JOIN planets pl ON pl.id = p.planet_id WHERE p.id = $1;'
      : 'SELECT p.*, a.sprite_url, a.style AS avatar_style, c.name AS country_name, ci.name AS city_name, pl.name AS planet_name, pl.currency_symbol FROM player_profiles p LEFT JOIN avatars a ON a.id = p.avatar_id LEFT JOIN countries c ON c.id = p.country_id LEFT JOIN cities ci ON ci.id = p.city_id LEFT JOIN planets pl ON pl.id = p.planet_id WHERE p.username = $1;';

    const profRes = await query(queryStr, [identifier]);
    if (profRes.rows.length === 0) {
      return res.status(404).json({ error: 'Citizen profile not found.' });
    }
    const profile = profRes.rows[0];

    // Fetch Stats
    const statsRes = await query('SELECT * FROM character_stats WHERE profile_id = $1;', [profile.id]);
    
    // Fetch Skills
    const skillsRes = await query(`
      SELECT s.name, s.category, ps.level, ps.current_xp 
      FROM player_skills ps
      JOIN skills s ON s.id = ps.skill_id
      WHERE ps.profile_id = $1;
    `, [profile.id]);

    // Fetch Achievements
    const achRes = await query(`
      SELECT a.title, a.description, a.icon, pa.unlocked_at
      FROM player_achievements pa
      JOIN achievements a ON a.id = pa.achievement_id
      WHERE pa.profile_id = $1;
    `, [profile.id]);

    // Fetch Current Job
    const jobRes = await query(`
      SELECT j.title, j.category, e.salary, e.performance, e.started_at
      FROM employment e
      JOIN jobs j ON j.id = e.job_id
      WHERE e.profile_id = $1 AND e.status = 'active';
    `, [profile.id]);

    return res.json({
      profile,
      stats: statsRes.rows[0] || {},
      skills: skillsRes.rows,
      achievements: achRes.rows,
      employment: jobRes.rows[0] || null,
      isOwner: req.user.profile_id === profile.id
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile: ' + err.message });
  }
});

/**
 * Update Profile (Bio, Status)
 */
router.put('/profile', authenticate, requireCharacter, async (req, res) => {
  try {
    const { bio, gender } = req.body;
    await query(`
      UPDATE player_profiles
      SET bio = COALESCE($1, bio), gender = COALESCE($2, gender), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [bio, gender, req.user.profile_id]);

    return res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * Life Stage / Age Progression (Section 6)
 */
router.post('/progress-age', authenticate, requireCharacter, async (req, res) => {
  try {
    const profRes = await query('SELECT virtual_age, experience_points, level FROM player_profiles WHERE id = $1;', [req.user.profile_id]);
    const current = profRes.rows[0];

    // Compute life stage
    const newAge = current.virtual_age + 1;
    let newStage = 'Early Adulthood';
    if (newAge <= 5) newStage = 'Childhood';
    else if (newAge <= 12) newStage = 'Primary Education';
    else if (newAge <= 17) newStage = 'Teenage Life';
    else if (newAge <= 25) newStage = 'University/Early Adulthood';
    else if (newAge <= 50) newStage = 'Career/Adult';
    else if (newAge <= 75) newStage = 'Senior Life';
    else newStage = 'Elder Life';

    await query(`
      UPDATE player_profiles 
      SET virtual_age = $1, life_stage = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [newAge, newStage, req.user.profile_id]);

    return res.json({
      success: true,
      virtualAge: newAge,
      lifeStage: newStage,
      message: `You advanced to virtual age ${newAge} (${newStage})!`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to progress age.' });
  }
});

export default router;
