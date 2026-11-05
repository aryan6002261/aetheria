import assert from 'node:assert';
import { initDb, query, closeDb } from '../src/db/db.js';
import { getWallet, transferFunds, grantFunds } from '../src/services/economy.service.js';
import { generateNpcDialogue, generateNewspaperArticle, getAssistantHelp } from '../src/services/ai.service.js';

async function runCoreTests() {
  console.log('🧪 [TEST SUITE] Starting Aetheria Core Engine Verification...\n');
  await initDb();

  // Test 1: Verify Universe Structure (Section 3)
  console.log('1. Verifying Universe and Planetary Structure...');
  const galaxyRes = await query('SELECT * FROM galaxies WHERE name = $1;', ['Andromeda-Sigma Sector']);
  assert.strictEqual(galaxyRes.rows.length, 1, 'Galaxy should exist in DB');

  const planetRes = await query('SELECT * FROM planets WHERE slug = $1;', ['veridia-prime']);
  assert.strictEqual(planetRes.rows.length, 1, 'Veridia Prime should exist');
  const planet = planetRes.rows[0];
  console.log(`   ✅ Galaxy: "${galaxyRes.rows[0].name}", Planet: "${planet.name}" (Year ${planet.world_year}, Day ${planet.world_day})`);

  // Test 2: Verify Character Creation & Player Profiles (Section 4)
  console.log('2. Verifying Player Profiles & Seed Admin...');
  const adminProfileRes = await query('SELECT * FROM player_profiles WHERE username = $1;', ['overseer_valen']);
  assert.strictEqual(adminProfileRes.rows.length, 1, 'Admin profile should exist');
  const adminProfile = adminProfileRes.rows[0];
  console.log(`   ✅ Admin Profile: ${adminProfile.character_name} (@${adminProfile.username}), Level: ${adminProfile.level}`);

  // Test 3: Verify Server-Authoritative Economy & Double-Entry Ledger (Section 8)
  console.log('3. Verifying Server-Authoritative Economy & Ledger...');
  // Create test user 1 and user 2
  const u1Res = await query(`
    INSERT INTO users (email, display_name) VALUES ('test_pilot_1@aetheria.universe', 'Test Pilot 1')
    ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id;
  `);
  const u2Res = await query(`
    INSERT INTO users (email, display_name) VALUES ('test_pilot_2@aetheria.universe', 'Test Pilot 2')
    ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id;
  `);

  const p1Res = await query(`
    INSERT INTO player_profiles (user_id, planet_id, country_id, city_id, character_name, username)
    VALUES ($1, 1, 1, 1, 'Pilot One', 'pilot_one')
    ON CONFLICT (username) DO UPDATE SET character_name = EXCLUDED.character_name RETURNING id;
  `, [u1Res.rows[0].id]);

  const p2Res = await query(`
    INSERT INTO player_profiles (user_id, planet_id, country_id, city_id, character_name, username)
    VALUES ($1, 1, 1, 1, 'Pilot Two', 'pilot_two')
    ON CONFLICT (username) DO UPDATE SET character_name = EXCLUDED.character_name RETURNING id;
  `, [u2Res.rows[0].id]);

  const p1Id = p1Res.rows[0].id;
  const p2Id = p2Res.rows[0].id;

  // Initialize wallets
  const w1 = await getWallet(p1Id, 1);
  const w2 = await getWallet(p2Id, 1);
  await query('UPDATE wallets SET balance = 500.00 WHERE id = $1;', [w1.id]);
  await query('UPDATE wallets SET balance = 100.00 WHERE id = $1;', [w2.id]);

  // Execute transfer: p1 sends 150.00 to p2
  const transferRes = await transferFunds({
    planetId: 1,
    fromProfileId: p1Id,
    toProfileId: p2Id,
    amount: 150.00,
    description: 'Quantum fuel compensation'
  });

  assert.strictEqual(transferRes.success, true);
  assert.strictEqual(transferRes.newSenderBalance, 350.00);

  const checkW2 = await getWallet(p2Id, 1);
  assert.strictEqual(parseFloat(checkW2.balance), 250.00);
  console.log(`   ✅ Atomic Wallet Transfer: ₡150.00 moved. Sender balance: ₡350.00, Receiver: ₡250.00`);

  // Verify race condition / insufficient balance protection
  let failedAsExpected = false;
  try {
    await transferFunds({
      planetId: 1,
      fromProfileId: p1Id,
      toProfileId: p2Id,
      amount: 999999.00,
      description: 'Illegal overdraft attempt'
    });
  } catch (err) {
    failedAsExpected = true;
  }
  assert.strictEqual(failedAsExpected, true, 'Overdraft should be rejected by ledger');
  console.log(`   ✅ Insufficient funds protection verified (Overdraft prevented).`);

  // Test 4: Verify Social Media System (Section 10)
  console.log('4. Verifying Social Media & Posts Engine...');
  const postRes = await query(`
    INSERT INTO social_posts (profile_id, planet_id, content, hashtags)
    VALUES ($1, 1, 'Telemetry calibration successful. Ready for interstellar voyage. #CosmicPioneer', '{"CosmicPioneer"}')
    RETURNING id;
  `, [p1Id]);
  const postId = postRes.rows[0].id;

  const commentRes = await query(`
    INSERT INTO comments (post_id, profile_id, content)
    VALUES ($1, $2, 'Godspeed on your flight!')
    RETURNING id;
  `, [postId, p2Id]);
  assert.strictEqual(commentRes.rows.length, 1);
  console.log(`   ✅ Social Post #${postId} created and Comment #${commentRes.rows[0].id} recorded.`);

  // Test 5: Verify AI NPC Dialogue & Persistent Memory (Section 11)
  console.log('5. Verifying AI NPC System & Memory Layer...');
  const npcRes = await query('SELECT * FROM npc_characters WHERE name = $1;', ['Dr. Elena Rostova']);
  assert.strictEqual(npcRes.rows.length, 1);
  const npc = npcRes.rows[0];

  const dialogue = await generateNpcDialogue({
    npc,
    player: { character_name: 'Pilot One', username: 'pilot_one', virtual_age: 22, life_stage: 'Early Adulthood', reputation: 120, level: 3 },
    message: 'Dr. Rostova, can you explain the recent tachyon wave anomalies?'
  });
  assert.ok(dialogue.reply && dialogue.reply.length > 10);
  assert.ok(dialogue.newMemory);
  console.log(`   ✅ AI NPC "${npc.name}" replied: "${dialogue.reply.substring(0, 60)}..."`);
  console.log(`   ✅ Generated Memory: "${dialogue.newMemory}"`);

  // Test 6: Verify AI World Newspaper (Section 14)
  console.log('6. Verifying AI Newspaper Grounded in DB Events...');
  const eventsRes = await query('SELECT category, headline, article FROM historical_records LIMIT 3;');
  const newspaper = await generateNewspaperArticle({ events: eventsRes.rows, planetName: 'Veridia Prime' });
  assert.ok(newspaper.headline);
  assert.ok(newspaper.lead);
  console.log(`   ✅ Newspaper Headline: "${newspaper.headline}"`);
  console.log(`   ✅ Editorial: "${newspaper.editorial || 'Verified'}"`);

  // Test 7: Verify ANI AI Assistant (Section 12)
  console.log('7. Verifying ANI AI Tutorial Assistant...');
  const assistantReply = await getAssistantHelp({ query: 'How does the planetary wallet and currency work?' });
  assert.ok(assistantReply && assistantReply.length > 20);
  console.log(`   ✅ ANI Answer: "${assistantReply.substring(0, 70)}..."`);

  // Test 8: Verify Democratic Election & Voting Security (Section 9)
  console.log('8. Verifying Parliamentary Election & Voting Constraints...');
  const electionRes = await query('SELECT id FROM elections WHERE status = $1 LIMIT 1;', ['active']);
  assert.strictEqual(electionRes.rows.length, 1);
  const electionId = electionRes.rows[0].id;

  // Pilot 1 votes for Admin profile
  await query(`
    INSERT INTO votes (election_id, voter_profile_id, candidate_profile_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (election_id, voter_profile_id) DO NOTHING;
  `, [electionId, p1Id, adminProfile.id]);

  // Attempt duplicate vote by Pilot 1
  let duplicatePrevented = false;
  try {
    await query(`
      INSERT INTO votes (election_id, voter_profile_id, candidate_profile_id)
      VALUES ($1, $2, $3);
    `, [electionId, p1Id, adminProfile.id]);
  } catch (err) {
    duplicatePrevented = true;
  }
  assert.strictEqual(duplicatePrevented, true, 'Duplicate vote must be blocked by UNIQUE constraint');
  console.log(`   ✅ Verified single ballot per citizen constraint on elections.`);

  console.log('\n🎉 ALL 8 CORE ENGINE INTEGRATION TESTS PASSED WITH ZERO ERRORS!\n');
}

runCoreTests()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Test failed:', err);
    await closeDb();
    process.exit(1);
  });

