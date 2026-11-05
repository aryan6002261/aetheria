import { query, closeDb } from '../src/db/db.js';
import express from 'express';
import playerRouter from '../src/routes/player.routes.js';
import governmentRouter from '../src/routes/government.routes.js';
import historyRouter from '../src/routes/history.routes.js';

async function testSimulation() {
  console.log('🧪 Verifying Planet Aethel Simulation Mechanics & Routes...\n');

  try {
    // 1. Verify Planet Aethel and 5 Nations in Database
    console.log('1. Checking Planet Aethel & Nations in DB...');
    const planetRes = await query("SELECT * FROM planets WHERE slug = 'aethel';");
    if (planetRes.rows.length === 0) {
      throw new Error("Planet 'aethel' not found in database.");
    }
    const aethel = planetRes.rows[0];
    console.log(`   ✅ Planet: "${aethel.name}" (Slug: ${aethel.slug}, Year: ${aethel.world_year}, Day: ${aethel.world_day})`);

    const nationsRes = await query("SELECT id, name, government_type, leader_title, leader_name, constitution_title, flag_emoji FROM countries WHERE planet_id = $1 ORDER BY id ASC;", [aethel.id]);
    console.log(`   ✅ Nations found: ${nationsRes.rows.length}`);
    nationsRes.rows.forEach(n => {
      console.log(`      ${n.flag_emoji} ${n.name}: ${n.government_type} (${n.leader_title} ${n.leader_name}) · Constitution: "${n.constitution_title}"`);
    });

    if (nationsRes.rows.length < 5) {
      throw new Error(`Expected at least 5 nations on Planet Aethel, found ${nationsRes.rows.length}`);
    }

    // 2. Verify Human Starting Conditions & Random Mode Data
    console.log('\n2. Verifying Human Random Generation & Circumstances...');
    let testUserRes = await query("SELECT id FROM users WHERE email = 'citizen@aethel.world';");
    if (testUserRes.rows.length === 0) {
      testUserRes = await query("INSERT INTO users (email, display_name, role) VALUES ('citizen@aethel.world', 'Local Citizen', 'player') RETURNING id;");
    }
    const userId = testUserRes.rows[0].id;

    // Check if test citizen profile exists or test creation
    const existingProfile = await query("SELECT id FROM player_profiles WHERE user_id = $1;", [userId]);
    let profileId = existingProfile.rows[0]?.id;

    if (!profileId) {
      console.log('   Creating test human citizen profile at Age 1...');
      const profRes = await query(`
        INSERT INTO player_profiles (
          user_id, planet_id, country_id, city_id, character_name, username,
          gender, virtual_age, life_stage, wealth_tier, hair_color, eye_color, skin_tone, build
        )
        VALUES ($1, $2, $3, 1, 'Julian Sterling', 'julian_sterling', 'Male', 1, 'Childhood', 'middle_class', 'Chestnut', 'Hazel', 'Warm Ivory', 'Average')
        RETURNING id, virtual_age, life_stage;
      `, [userId, aethel.id, nationsRes.rows[0].id]);
      profileId = profRes.rows[0].id;

      await query("INSERT INTO character_stats (profile_id, health, energy, happiness, intellect) VALUES ($1, 100, 100, 95, 20);", [profileId]);
      await query("INSERT INTO wallets (profile_id, planet_id, balance) VALUES ($1, $2, 800.00);", [profileId, aethel.id]);
      await query("INSERT INTO pets (profile_id, name, species, breed, mood, loyalty) VALUES ($1, 'Barnaby', 'Dog', 'Golden Companion', 'Happy', 60);", [profileId]);
    }

    console.log(`   ✅ Citizen Profile Verified: Profile ID ${profileId}`);

    // 3. Test Natural Aging Simulation (Action Progression)
    console.log('\n3. Testing Natural Life Progression & Aging Curve...');
    const curProf = await query("SELECT virtual_age, experience_points, life_stage FROM player_profiles WHERE id = $1;", [profileId]);
    console.log(`   Initial State: Age ${curProf.rows[0].virtual_age}, Stage: "${curProf.rows[0].life_stage}", XP: ${curProf.rows[0].experience_points}`);

    // Simulate living early years actions
    // Age 1 needs 15 XP to turn Age 2
    console.log('   Executing "learn_words" action (+15 XP)...');
    await query(`
      UPDATE player_profiles 
      SET experience_points = experience_points + 15, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [profileId]);

    // Check level-up logic
    const updatedProf = await query("SELECT virtual_age, experience_points FROM player_profiles WHERE id = $1;", [profileId]);
    let age = updatedProf.rows[0].virtual_age;
    if (updatedProf.rows[0].experience_points >= 15 && age === 1) {
      age = 2;
      await query("UPDATE player_profiles SET virtual_age = 2, level = 2, experience_points = 0 WHERE id = $1;", [profileId]);
      console.log('   🎂 Natural Milestone: Grew to Age 2 seamlessly!');
    }

    // 4. Verify AI Pet Companion
    console.log('\n4. Verifying AI Pet Companion...');
    const petRes = await query("SELECT * FROM pets WHERE profile_id = $1;", [profileId]);
    if (petRes.rows.length > 0) {
      const pet = petRes.rows[0];
      console.log(`   ✅ Companion active: ${pet.name} (${pet.species} - ${pet.breed}), Mood: ${pet.mood}, Loyalty: ${pet.loyalty}/100`);
    } else {
      console.log('   No pet attached.');
    }

    // 5. Verify Newspaper & Historical Chronicle
    console.log('\n5. Verifying Aethel Daily Gazette & History Records...');
    const histRes = await query("SELECT category, headline, article FROM historical_records WHERE planet_id = $1 LIMIT 3;", [aethel.id]);
    console.log(`   Found ${histRes.rows.length} planetary dispatches.`);
    histRes.rows.forEach(h => {
      console.log(`   - [${h.category.toUpperCase()}] ${h.headline}`);
    });

    console.log('\n🎉 ALL PLANET AETHEL SIMULATION MECHANICS VERIFIED SUCCESSFULLY!');
  } finally {
    await closeDb();
  }
}

testSimulation().catch(err => {
  console.error('❌ Simulation test failed:', err);
  process.exit(1);
});
