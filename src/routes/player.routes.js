import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter, generateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { config } from '../config/config.js';

const router = express.Router();

/**
 * Generate randomized starting circumstances for Human Random Life Mode
 */
router.get('/random-preview', authenticate, async (req, res) => {
  try {
    const firstNames = [
      'Liam', 'Julian', 'Lucas', 'Oliver', 'Noah', 'Ethan', 'Arthur', 'Alexander', 'Marcus', 'Gabriel',
      'Emma', 'Sophia', 'Olivia', 'Elena', 'Clara', 'Aria', 'Isabella', 'Lyra', 'Amara', 'Beatrice'
    ];
    const lastNames = [
      'Sterling', 'Vance', 'Howard', 'Miller', 'Jenkins', 'Gallagher', 'Chen', 'Thorne', 'Mercer', 'Cross',
      'Sinclair', 'Blackwood', 'Al-Mansur', 'Rousseau', 'Winter', 'Ashford', 'Hawthorne', 'Novak'
    ];

    const hairColors = ['Dark Brown', 'Black', 'Golden Blonde', 'Chestnut', 'Auburn', 'Copper Red', 'Silver Grey'];
    const hairStyles = ['Short Wavy', 'Curly', 'Short Straight', 'Long Braided', 'Ponytail', 'Buzz Cut'];
    const eyeColors = ['Brown', 'Hazel', 'Deep Blue', 'Emerald Green', 'Amber', 'Slate Grey'];
    const skinTones = ['Fair', 'Warm Ivory', 'Olive', 'Tan', 'Rich Bronze', 'Deep Chestnut'];
    const builds = ['Slender', 'Athletic', 'Average', 'Muscular', 'Sturdy'];

    const wealthOptions = [
      { tier: 'working_class', label: 'Working Class Household', balance: 150.00, desc: 'Raised in a hardworking artisan or trade family. Taught the value of honest labor and resilience.' },
      { tier: 'middle_class', label: 'Middle Class Family', balance: 800.00, desc: 'Raised in a comfortable municipal neighborhood with access to books, local academies, and stability.' },
      { tier: 'affluent', label: 'Affluent / Aristocratic Heritage', balance: 4500.00, desc: 'Born into an esteemed merchant guild or noble estate with significant family resources and influence.' }
    ];

    const petOptions = [
      { species: 'Dog', name: 'Barnaby', breed: 'Golden Companion' },
      { species: 'Cat', name: 'Milo', breed: 'Calico' },
      { species: 'Owl', name: 'Athena', breed: 'Barn Owl' },
      { species: 'Rabbit', name: 'Pip', breed: 'Angora' },
      { species: 'None', name: null, breed: null }
    ];

    const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${randomFirstName} ${randomLastName}`;
    const cleanUsername = `${randomFirstName.toLowerCase()}_${randomLastName.toLowerCase()}`.replace(/[^a-z0-9_]/g, '');

    const genderList = ['Male', 'Female', 'Non-binary'];
    const randomGender = genderList[Math.floor(Math.random() * genderList.length)];

    // Fetch nations from Planet Aethel
    const countriesRes = await query(`
      SELECT c.id, c.name, c.government_type, c.flag_emoji, c.leader_title, c.leader_name
      FROM countries c
      WHERE c.is_active = TRUE
      ORDER BY RANDOM() LIMIT 1;
    `);

    const chosenCountry = countriesRes.rows[0] || {
      id: 1,
      name: 'The Kingdom of Eldoria',
      government_type: 'Constitutional Monarchy',
      flag_emoji: '👑',
      leader_title: 'King',
      leader_name: 'Alden IV'
    };

    // Fetch city in chosen country
    const cityRes = await query(`
      SELECT id, name, description FROM cities WHERE country_id = $1 ORDER BY RANDOM() LIMIT 1;
    `, [chosenCountry.id]);
    const chosenCity = cityRes.rows[0] || { id: 1, name: "Crown's Landing", description: 'The royal capital.' };

    const chosenWealth = wealthOptions[Math.floor(Math.random() * wealthOptions.length)];
    const chosenPet = petOptions[Math.floor(Math.random() * petOptions.length)];

    const physical = {
      hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
      hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
      eyeColor: eyeColors[Math.floor(Math.random() * eyeColors.length)],
      skinTone: skinTones[Math.floor(Math.random() * skinTones.length)],
      heightCm: 160 + Math.floor(Math.random() * 28),
      build: builds[Math.floor(Math.random() * builds.length)]
    };

    return res.json({
      suggestedName: fullName,
      suggestedUsername: cleanUsername,
      gender: randomGender,
      countryId: chosenCountry.id,
      countryName: chosenCountry.name,
      governmentType: chosenCountry.government_type,
      flagEmoji: chosenCountry.flag_emoji,
      leaderTitle: chosenCountry.leader_title,
      leaderName: chosenCountry.leader_name,
      cityId: chosenCity.id,
      cityName: chosenCity.name,
      wealthTier: chosenWealth.tier,
      wealthLabel: chosenWealth.label,
      startingBalance: chosenWealth.balance,
      background: chosenWealth.desc,
      physical,
      pet: chosenPet,
      virtualAge: 1,
      lifeStage: 'Childhood'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate random preview: ' + err.message });
  }
});

/**
 * Character Creation (Always starts as a human at Age 1 on Planet Aethel)
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const {
      characterName,
      username,
      gender = 'Non-binary',
      countryId,
      cityId,
      wealthTier = 'working_class',
      hairColor = 'Brown',
      hairStyle = 'Short Wavy',
      eyeColor = 'Brown',
      skinTone = 'Medium',
      heightCm = 170,
      build = 'Average',
      petSpecies,
      petName,
      bio,
      birthMode = 'custom'
    } = req.body;

    if (!characterName || !username) {
      return res.status(400).json({ error: 'Character name and username are required.' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 25) {
      return res.status(400).json({ error: 'Username must be between 3 and 25 alphanumeric characters.' });
    }

    // Check if user already has an active character
    const existingCheck = await query('SELECT id FROM player_profiles WHERE user_id = $1;', [req.user.id]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active citizen character.' });
    }

    // Resolve planet (Aethel)
    const planetRes = await query("SELECT id FROM planets WHERE slug = 'aethel' LIMIT 1;");
    const planetId = planetRes.rows[0]?.id || 1;

    // Resolve Country & City
    let finalCountryId = countryId || req.body.selectedCountryId;
    let finalCityId = cityId || req.body.selectedCityId;

    if (!finalCountryId) {
      const cRes = await query('SELECT id FROM countries WHERE planet_id = $1 ORDER BY id ASC LIMIT 1;', [planetId]);
      finalCountryId = cRes.rows[0]?.id || 1;
    }

    if (!finalCityId) {
      const ciRes = await query('SELECT id FROM cities WHERE country_id = $1 ORDER BY id ASC LIMIT 1;', [finalCountryId]);
      finalCityId = ciRes.rows[0]?.id || 1;
    }

    // Determine initial wallet balance based on family wealth
    let initialBalance = 150.00;
    if (wealthTier === 'middle_class') initialBalance = 800.00;
    if (wealthTier === 'affluent') initialBalance = 4500.00;

    let createdProfile = null;

    await transaction(async (client) => {
      // 1. Create Human Avatar
      const spriteUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${cleanUsername}`;
      const avatarRes = await client.query(`
        INSERT INTO avatars (style, hair, skin, eye_color, clothing, sprite_url)
        VALUES ('human_natural', $1, $2, $3, 'everyday_clothing', $4)
        RETURNING id;
      `, [hairColor, skinTone, eyeColor, spriteUrl]);
      const avatarId = avatarRes.rows[0].id;

      // 2. Create Player Profile at Age 1 (Childhood)
      const profRes = await client.query(`
        INSERT INTO player_profiles (
          user_id, planet_id, country_id, city_id, character_name, username,
          avatar_id, gender, virtual_age, life_stage, wealth_tier,
          hair_color, hair_style, eye_color, skin_tone, height_cm, build,
          bio, birth_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'Childhood', $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *;
      `, [
        req.user.id,
        planetId,
        finalCountryId,
        finalCityId,
        characterName.trim(),
        cleanUsername,
        avatarId,
        gender,
        wealthTier,
        hairColor,
        hairStyle,
        eyeColor,
        skinTone,
        heightCm || 170,
        build || 'Average',
        bio || `Born into ${wealthTier.replace('_', ' ')} circumstances on Planet Aethel.`,
        birthMode
      ]);
      createdProfile = profRes.rows[0];

      // 3. Create Initial Character Stats
      await client.query(`
        INSERT INTO character_stats (profile_id, health, energy, happiness, intellect, charisma, strength)
        VALUES ($1, 100, 100, 95, 20, 30, 20);
      `, [createdProfile.id]);

      // 4. Initialize Wallet with Family Starter Savings
      await client.query(`
        INSERT INTO wallets (profile_id, planet_id, balance)
        VALUES ($1, $2, $3);
      `, [createdProfile.id, planetId, initialBalance]);

      // 5. If Pet Chosen, Add AI Pet Companion
      if (petSpecies && petSpecies !== 'None') {
        await client.query(`
          INSERT INTO pets (profile_id, name, species, breed, mood, hunger, loyalty)
          VALUES ($1, $2, $3, $4, 'Happy', 20, 60);
        `, [createdProfile.id, petName || 'Companion', petSpecies, `${petSpecies} Companion`]);
      }

      // 6. Record Initial Birth Milestone in Life Logs
      await client.query(`
        INSERT INTO life_logs (profile_id, virtual_age, world_year, world_day, action_type, description, xp_gained, credits_changed)
        VALUES ($1, 1, 2026, 1, 'BIRTH', $2, 0, $3);
      `, [
        createdProfile.id,
        `Born into ${wealthTier.replace('_', ' ')} household in ${createdProfile.character_name}'s family lineage. Started life at Age 1.`,
        initialBalance
      ]);
    });

    // Generate JWT token with updated profile ID
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
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Citizen created successfully! Welcome to Aethel.',
      profile: createdProfile,
      redirect: '/dashboard.html'
    });
  } catch (err) {
    console.error('[PLAYER] Creation error:', err);
    return res.status(500).json({ error: 'Failed to create character: ' + err.message });
  }
});

/**
 * Natural Daily Life Action & Aging Simulation
 * Simulates living a day in the virtual world. Takes actions based on life stage.
 * Progresses age naturally: early years (1-5) grow quickly, then scales progressively.
 */
router.post('/live-day', authenticate, requireCharacter, async (req, res) => {
  try {
    const { actionId } = req.body;

    const profRes = await query(`
      SELECT p.*, c.name AS country_name, c.tax_rate, c.government_type,
             w.balance AS wallet_balance,
             s.health, s.energy, s.happiness, s.intellect, s.charisma, s.strength,
             pl.world_year, pl.world_day
      FROM player_profiles p
      JOIN planets pl ON pl.id = p.planet_id
      JOIN countries c ON c.id = p.country_id
      LEFT JOIN wallets w ON w.profile_id = p.id
      LEFT JOIN character_stats s ON s.profile_id = p.id
      WHERE p.id = $1;
    `, [req.user.profile_id]);

    const p = profRes.rows[0];
    const age = p.virtual_age;

    // Define Action Effects tailored to Age & Real-Life Stages
    const actionCatalog = {
      // Childhood (Age 1-5): Fast early development
      learn_words: { name: 'Learn First Words', xp: 15, health: 0, energy: -10, happiness: 5, intellect: 10, credits: 0, story: 'Looked at colorful picture books and learned new vocabulary with family.' },
      play_toys: { name: 'Play with Toys', xp: 15, health: 0, energy: -10, happiness: 15, intellect: 5, credits: 0, story: 'Built tall wooden block castles in the playroom and giggled with joy.' },
      play_pet: { name: 'Play with Pet', xp: 15, health: 0, energy: -10, happiness: 20, intellect: 5, credits: 0, story: 'Pet and cuddled your AI companion, hearing gentle purrs and playful barks.' },
      family_time: { name: 'Bond with Family', xp: 15, health: 5, energy: 0, happiness: 20, intellect: 5, credits: 0, story: 'Spent a warm evening listening to parents tell folk tales about Aethel.' },
      nap_eat: { name: 'Nap & Eat Well', xp: 10, health: 15, energy: 40, happiness: 10, intellect: 0, credits: 0, story: 'Ate a wholesome warm meal and rested peacefully through the afternoon.' },

      // Primary Education (Age 6-12)
      attend_school: { name: 'Attend Primary Classes', xp: 25, health: 0, energy: -20, happiness: 5, intellect: 15, credits: 0, story: 'Attended elementary school lessons in reading, arithmetic, and world science.' },
      do_homework: { name: 'Study & Read at Library', xp: 30, health: 0, energy: -15, happiness: 0, intellect: 20, credits: 0, story: 'Finished writing assignments and explored historical atlases at the public library.' },
      schoolyard_play: { name: 'Play with Classmates', xp: 20, health: 5, energy: -20, happiness: 25, intellect: 0, credits: 0, story: 'Ran around the school courtyard playing tag with childhood friends.' },
      get_allowance: { name: 'Collect Pocket Allowance', xp: 10, health: 0, energy: 0, happiness: 15, intellect: 5, credits: 20.00, story: 'Received a modest weekly pocket allowance of ₡20.00 from parents for doing chores.' },

      // High School & Teenage (Age 13-17)
      attend_high_school: { name: 'Attend Secondary Lectures', xp: 35, health: 0, energy: -25, happiness: 5, intellect: 25, credits: 0, story: 'Participated in advanced science lab experiments and literature debates at high school.' },
      part_time_job: { name: 'Work Part-Time Shift', xp: 40, health: 0, energy: -30, happiness: 5, intellect: 10, credits: 65.00, story: 'Earned ₡65.00 assisting at the local community market and organizing supplies.' },
      study_exams: { name: 'Study for National Exams', xp: 50, health: -5, energy: -35, happiness: -5, intellect: 35, credits: 0, story: 'Studied deeply for upcoming nationwide university and vocational entrance exams.' },
      hang_out: { name: 'Socialize in Town', xp: 25, health: 0, energy: -20, happiness: 30, intellect: 5, credits: -10.00, story: 'Met friends at the town cafe for hot tea and exchanged stories about the future.' },

      // Adult (Age 18+)
      work_career: { name: 'Work Full-Time Career Shift', xp: 60, health: -5, energy: -35, happiness: 5, intellect: 15, credits: 160.00, story: 'Completed a productive professional work day at your career, contributing to the nation.' },
      attend_university: { name: 'Attend University Lecture', xp: 65, health: 0, energy: -30, happiness: 5, intellect: 35, credits: -25.00, story: 'Attended post-secondary lectures and engaged in thesis research on sustainable governance.' },
      run_business: { name: 'Manage Commercial Enterprise', xp: 55, health: -5, energy: -30, happiness: 10, intellect: 25, credits: 210.00, story: 'Reviewed product manufacturing, employee payroll, and balanced company revenue ledgers.' },
      bank_and_invest: { name: 'Deposit in Bank Savings', xp: 30, health: 0, energy: 0, happiness: 10, intellect: 15, credits: 15.00, story: 'Deposited surplus credits into your national bank high-yield savings account to earn compound interest.' },
      civic_action: { name: 'Civic & Political Action', xp: 45, health: 0, energy: -15, happiness: 15, intellect: 20, credits: 0, story: 'Participated in town hall debates, reviewed government decrees, and engaged in civic duties.' },
      exercise_gym: { name: 'Exercise & Outdoor Run', xp: 30, health: 20, energy: -25, happiness: 15, intellect: 0, credits: 0, story: 'Jogged through the city gardens and completed a healthy fitness routine.' },
      rest_recover: { name: 'Rest, Cook & Sleep', xp: 15, health: 25, energy: 60, happiness: 20, intellect: 0, credits: -5.00, story: 'Prepared fresh home-cooked food, groomed your pet, and slept peacefully through the night.' }
    };

    const action = actionCatalog[actionId] || (age <= 5 ? actionCatalog.learn_words : (age <= 12 ? actionCatalog.attend_school : actionCatalog.work_career));

    // Calculate Age XP Curve:
    // Age 1: 15 XP, Age 2: 25 XP, Age 3: 35 XP, Age 4: 45 XP
    // Age 5-12: age * 25 XP
    // Age 13-17: age * 40 XP
    // Age 18+: age * 80 XP
    function getXpNeededForAge(a) {
      if (a === 1) return 15;
      if (a === 2) return 25;
      if (a === 3) return 35;
      if (a === 4) return 45;
      if (a <= 12) return a * 25;
      if (a <= 17) return a * 40;
      return a * 80;
    }

    const currentXp = p.experience_points + action.xp;
    const xpThreshold = getXpNeededForAge(age);
    let newAge = age;
    let newStage = p.life_stage;
    let leveledUp = false;
    let remainingXp = currentXp;

    if (currentXp >= xpThreshold) {
      newAge = age + 1;
      remainingXp = currentXp - xpThreshold;
      leveledUp = true;

      // Update Life Stage
      if (newAge <= 5) newStage = 'Childhood';
      else if (newAge <= 12) newStage = 'Primary Education';
      else if (newAge <= 17) newStage = 'Teenage Life';
      else if (newAge <= 24) newStage = 'University & Early Career';
      else if (newAge <= 50) newStage = 'Career & Adult Life';
      else newStage = 'Senior Life';
    }

    // Compute Net Income after national tax if adult working
    let netCreditsChange = action.credits;
    if (netCreditsChange > 0 && age >= 18 && p.tax_rate) {
      const taxDeduction = (netCreditsChange * (Number(p.tax_rate) / 100));
      netCreditsChange = netCreditsChange - taxDeduction;
    }

    // Apply stats clamps (0 to 100)
    const newHealth = Math.min(100, Math.max(10, p.health + action.health));
    const newEnergy = Math.min(100, Math.max(10, p.energy + action.energy));
    const newHappiness = Math.min(100, Math.max(10, p.happiness + action.happiness));
    const newIntellect = Math.min(100, Math.max(10, p.intellect + action.intellect));

    await transaction(async (client) => {
      // 1. Update Profile & Experience
      await client.query(`
        UPDATE player_profiles
        SET virtual_age = $1, life_stage = $2, experience_points = $3, level = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4;
      `, [newAge, newStage, remainingXp, p.id]);

      // 2. Update Stats
      await client.query(`
        UPDATE character_stats
        SET health = $1, energy = $2, happiness = $3, intellect = $4, updated_at = CURRENT_TIMESTAMP
        WHERE profile_id = $5;
      `, [newHealth, newEnergy, newHappiness, newIntellect, p.id]);

      // 3. Update Wallet if credits changed
      if (netCreditsChange !== 0) {
        await client.query(`
          UPDATE wallets
          SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
          WHERE profile_id = $2;
        `, [netCreditsChange, p.id]);
      }

      // 4. Advance Planet World Day
      await client.query(`
        UPDATE planets
        SET world_day = world_day + 1
        WHERE id = $1;
      `, [p.planet_id]);

      // 5. Record Life Log
      const narrative = leveledUp 
        ? `${action.story} 🎂 Happy Birthday! You have grown to Age ${newAge} (${newStage})!` 
        : action.story;

      await client.query(`
        INSERT INTO life_logs (profile_id, virtual_age, world_year, world_day, action_type, description, xp_gained, credits_changed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [p.id, newAge, p.world_year, p.world_day + 1, actionId, narrative, action.xp, netCreditsChange]);

      // If leveled up, log a celebration milestone
      if (leveledUp) {
        await client.query(`
          INSERT INTO historical_records (planet_id, world_year, world_day, category, headline, article)
          VALUES ($1, $2, $3, 'milestone', $4, $5);
        `, [
          p.planet_id,
          p.world_year,
          p.world_day + 1,
          `Citizen Milestone: ${p.character_name} Celebrates Age ${newAge}`,
          `${p.character_name} has officially advanced to virtual age ${newAge} in the nation of ${p.country_name}. Currently residing in ${p.life_stage}.`
        ]);
      }
    });

    return res.json({
      success: true,
      actionName: action.name,
      story: action.story,
      leveledUp,
      newAge,
      newStage,
      gainedXp: action.xp,
      remainingXp,
      nextXpNeeded: getXpNeededForAge(newAge),
      netCredits: netCreditsChange,
      stats: {
        health: newHealth,
        energy: newEnergy,
        happiness: newHappiness,
        intellect: newIntellect
      }
    });
  } catch (err) {
    console.error('[PLAYER] Live day error:', err);
    return res.status(500).json({ error: 'Failed to process life day action: ' + err.message });
  }
});

/**
 * Get Active Pet Companion
 */
router.get('/pet', authenticate, requireCharacter, async (req, res) => {
  try {
    const petRes = await query('SELECT * FROM pets WHERE profile_id = $1 LIMIT 1;', [req.user.profile_id]);
    return res.json({ pet: petRes.rows[0] || null });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pet: ' + err.message });
  }
});

/**
 * Get Life Logs / Timeline
 */
router.get('/timeline', authenticate, requireCharacter, async (req, res) => {
  try {
    const logsRes = await query(`
      SELECT * FROM life_logs 
      WHERE profile_id = $1 
      ORDER BY id DESC LIMIT 20;
    `, [req.user.profile_id]);
    return res.json({ timeline: logsRes.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch life timeline.' });
  }
});

/**
 * Get Current User Profile with Country, Government, Constitution & Pet
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const profileRes = await query(`
      SELECT p.*, a.sprite_url, w.balance AS wallet_balance,
             c.name AS country_name, c.government_type, c.flag_emoji, c.leader_title, c.leader_name,
             c.tax_rate, c.constitution_title, c.constitution_text,
             ci.name AS city_name, pl.name AS planet_name, pl.currency_symbol, pl.world_year, pl.world_day
      FROM player_profiles p
      LEFT JOIN avatars a ON a.id = p.avatar_id
      LEFT JOIN wallets w ON w.profile_id = p.id
      LEFT JOIN countries c ON c.id = p.country_id
      LEFT JOIN cities ci ON ci.id = p.city_id
      LEFT JOIN planets pl ON pl.id = p.planet_id
      WHERE p.user_id = $1
      ORDER BY p.id DESC LIMIT 1;
    `, [req.user.id]);

    const profile = profileRes.rows[0] || null;
    let stats = null;
    let pet = null;

    if (profile) {
      const statsRes = await query('SELECT * FROM character_stats WHERE profile_id = $1;', [profile.id]);
      stats = statsRes.rows[0] || null;

      const petRes = await query('SELECT * FROM pets WHERE profile_id = $1 LIMIT 1;', [profile.id]);
      pet = petRes.rows[0] || null;
    }

    return res.json({
      user: req.user,
      profile,
      stats,
      pet,
      hasCharacter: !!profile
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch player session.' });
  }
});

export default router;
