import { initDb, query, closeDb } from './db.js';

export async function seedDatabase() {
  console.log('[SEED] Starting universe seed...');
  await initDb();

  // 1. Galaxy
  const galaxyRes = await query(`
    INSERT INTO galaxies (name, description, coordinates)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id;
  `, ['Andromeda-Sigma Sector', 'A bustling star cluster housing emerging post-solar civilizations.', '042, 118, 903']);
  const galaxyId = galaxyRes.rows[0].id;

  // 2. First Planet: Veridia Prime
  const planetRes = await query(`
    INSERT INTO planets (galaxy_id, name, slug, description, currency_name, currency_symbol, population, is_discovered, day_cycle, world_year, world_day, timeline_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (slug) DO UPDATE SET population = EXCLUDED.population
    RETURNING id;
  `, [
    galaxyId,
    'Veridia Prime',
    'veridia-prime',
    'A lush, neon-illuminated terrestrial world with twin binary suns. The vanguard of humanity’s 22nd-century second civilization.',
    'Credits',
    '₡',
    42850,
    true,
    24,
    2185,
    142,
    'Golden Age of Expansion'
  ]);
  const planetId = planetRes.rows[0].id;

  // 3. First Country: Neo-Arcadia
  const countryRes = await query(`
    INSERT INTO countries (planet_id, name, code, description, capital_city, tax_rate, treasury_balance, government_type)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (planet_id, name) DO UPDATE SET tax_rate = EXCLUDED.tax_rate
    RETURNING id;
  `, [
    planetId,
    'Neo-Arcadia',
    'ARC',
    'A flourishing sovereign technocracy known for high-altitude bio-domes and direct participatory democracy.',
    'Aethel City',
    7.50,
    1500000.00,
    'Representative Cyber-Parliament'
  ]);
  const countryId = countryRes.rows[0].id;

  // 4. Region & Cities
  const regionRes = await query(`
    INSERT INTO regions (country_id, name, climate)
    VALUES ($1, $2, $3)
    RETURNING id;
  `, [countryId, 'Solaris Basin', 'Temperate Neo-Urban']);
  const regionId = regionRes.rows[0].id;

  const city1Res = await query(`
    INSERT INTO cities (region_id, country_id, name, description, population)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `, [regionId, countryId, 'Aethel City', 'The planetary capital, famed for its towering crystal spires and thriving commerce.', 31200]);
  const city1Id = city1Res.rows[0].id;

  const city2Res = await query(`
    INSERT INTO cities (region_id, country_id, name, description, population)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `, [regionId, countryId, 'Nova Haven', 'A coastal orbital telemetry port and university enclave.', 11650]);
  const city2Id = city2Res.rows[0].id;

  // Communities
  await query(`
    INSERT INTO communities (city_id, name, description)
    VALUES 
      ($1, 'Nexus Spire District', 'High-density commercial and residential hub in central Aethel City.'),
      ($1, 'Cyber Promenade', 'Vibrant district with cafes, open markets, and neon walkways.'),
      ($2, 'Astro-Dock Commons', 'Coastal spaceport community of navigators and researchers.')
  `, [city1Id, city2Id]);

  // 5. Skills
  const skillsList = [
    ['Quantum Programming', 'Technical', 'Developing quantum neural nets and high-speed algorithms.', 100],
    ['Cybernetic Engineering', 'Technical', 'Constructing mechanical frames, prosthetics, and sensory rigs.', 100],
    ['Biomedical Science', 'Scientific', 'Cellular regeneration and human enhancement therapies.', 100],
    ['Astro-Physics', 'Scientific', 'Orbital mechanics, stellar anomalies, and warp physics.', 100],
    ['Diplomacy & Governance', 'Leadership', 'Negotiation, parliamentary debate, and public administration.', 100],
    ['Market Economics', 'Commerce', 'Trading, supply chains, arbitrage, and corporate management.', 100],
    ['Holonet Journalism', 'Social', 'Broadcasting, investigative reporting, and public relations.', 100],
    ['Neural Arts & Media', 'Artistic', 'Virtual reality composition, digital aesthetics, and music.', 100]
  ];

  for (const [name, cat, desc, maxLvl] of skillsList) {
    await query(`
      INSERT INTO skills (name, category, description, max_level)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING;
    `, [name, cat, desc, maxLvl]);
  }

  // 6. Education Institutions
  await query(`
    INSERT INTO education_institutions (city_id, name, type, description, tuition_fee, reputation)
    VALUES 
      ($1, 'Aethel Imperial Polytechnic', 'Polytechnic University', 'World-class technological academy offering engineering and cybernetics degrees.', 250.00, 94),
      ($2, 'Nova Haven Academy of Sciences', 'Academy of Sciences', 'Prestigious institution focused on astro-physics and quantum exploration.', 400.00, 96),
      ($1, 'Arcadia Free Conservatory of Arts', 'Arts Conservatory', 'Public artistic academy dedicated to music, holonet journalism, and digital arts.', 0.00, 85);
  `, [city1Id, city2Id]);

  // 7. Career Paths / Jobs
  await query(`
    INSERT INTO jobs (country_id, title, category, min_skill_level, base_salary, description, icon)
    VALUES 
      ($1, 'Junior Cyber-Security Specialist', 'Engineering', 2, 350.00, 'Monitor and safeguard civilian quantum communications.', 'bi-shield-lock-fill'),
      ($1, 'Lead Systems Architect', 'Engineering', 10, 850.00, 'Design planetary cloud infrastructure and power grid arrays.', 'bi-cpu-fill'),
      ($1, 'Clinical Bio-Physician', 'Medical', 8, 750.00, 'Provide gene therapy and cyber-trauma treatment.', 'bi-heart-pulse-fill'),
      ($1, 'Parliamentary Analyst', 'Governance', 5, 580.00, 'Draft civic legislation and analyze planetary election trends.', 'bi-bank2'),
      ($1, 'Quantum Market Trader', 'Commerce', 6, 920.00, 'Trade commodities and securities across planetary exchanges.', 'bi-graph-up-arrow'),
      ($1, 'Investigative Holo-Journalist', 'Media', 3, 420.00, 'Investigate planetary stories for The Veridian Chronicle.', 'bi-newspaper'),
      ($1, 'Orbital Spaceflight Navigator', 'Science', 12, 1100.00, 'Chart planetary shuttles through binary stellar flares.', 'bi-rocket-takeoff-fill')
  `, [countryId]);

  // 8. Admin & Overseer System User
  const adminUserRes = await query(`
    INSERT INTO users (email, display_name, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
    RETURNING id;
  `, ['admin@aetheria.universe', 'Overseer Valen', 'admin']);
  const adminUserId = adminUserRes.rows[0].id;

  // Add auth provider for admin
  await query(`
    INSERT INTO user_auth_providers (user_id, provider, provider_user_id, profile_data)
    VALUES ($1, 'local_demo', 'admin_overseer', '{"name": "Overseer Valen", "email": "admin@aetheria.universe"}')
    ON CONFLICT (provider, provider_user_id) DO NOTHING;
  `, [adminUserId]);

  // Admin Avatar & Profile
  const avatarRes = await query(`
    INSERT INTO avatars (style, hair, skin, eye_color, clothing, accessories, sprite_url)
    VALUES ('cyber_legend', 'silver_hawk', 'tone_2', 'neon_blue', 'admiral_longcoat', 'golden_hologram_crest', '/img/avatars/admin.png')
    RETURNING id;
  `);
  const adminAvatarId = avatarRes.rows[0].id;

  const profileRes = await query(`
    INSERT INTO player_profiles (user_id, planet_id, country_id, city_id, character_name, username, avatar_id, gender, virtual_age, life_stage, bio, reputation, experience_points, level, birth_mode)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'custom')
    ON CONFLICT (username) DO UPDATE SET reputation = EXCLUDED.reputation
    RETURNING id;
  `, [
    adminUserId,
    planetId,
    countryId,
    city1Id,
    'Overseer Valen',
    'overseer_valen',
    adminAvatarId,
    'Non-binary',
    42,
    'Career/Adult',
    'Supreme Custodian of Veridia Prime. Guardian of civilization equilibrium.',
    999,
    15000,
    50
  ]);
  const adminProfileId = profileRes.rows[0].id;

  // Admin Character Stats & Wallet
  await query(`
    INSERT INTO character_stats (profile_id, health, energy, happiness, intellect, charisma, strength)
    VALUES ($1, 100, 100, 95, 95, 90, 85)
    ON CONFLICT (profile_id) DO NOTHING;
  `, [adminProfileId]);

  await query(`
    INSERT INTO wallets (profile_id, planet_id, balance)
    VALUES ($1, $2, 250000.00)
    ON CONFLICT (profile_id, planet_id) DO UPDATE SET balance = EXCLUDED.balance;
  `, [adminProfileId, planetId]);

  await query(`
    INSERT INTO bank_accounts (profile_id, planet_id, account_number, balance, savings_rate)
    VALUES ($1, $2, 'ARC-BNK-00001', 500000.00, 3.5)
    ON CONFLICT DO NOTHING;
  `, [adminProfileId, planetId]);

  // 9. AI NPCs with Persistent Personalities & Daily Schedules
  const npcs = [
    {
      name: 'Dr. Elena Rostova',
      age: 38,
      gender: 'Female',
      occupation: 'Dean of Quantum Sciences',
      personality: 'Analytical, visionary, deeply empathetic toward young researchers. Fascinated by stellar radio anomalies.',
      background: 'Born during the First Colonization Flotilla. Pioneer in tachyon array computing at Aethel Polytechnic.',
      goals: 'Decode persistent harmonic pulses detected in the Oort Cloud of Veridia Prime.',
      schedule: JSON.stringify({
        morning: '08:00 - 12:00: Lecturing quantum physics at Imperial Polytechnic',
        afternoon: '13:00 - 17:00: Laboratory experiments in quantum resonance',
        evening: '18:30 - 21:00: Relaxing at Nexus Cyber-Lounge and mentoring students'
      }),
      avatar: '/img/avatars/npc_elena.png'
    },
    {
      name: 'Marcus Thorne',
      age: 49,
      gender: 'Male',
      occupation: 'President of the Arcadian Senate',
      personality: 'Diplomatic, charismatic, steadfast champion of civic transparency and fair economic trade.',
      background: 'Former civil engineer who led construction of Aethel City’s bio-domes before entering politics.',
      goals: 'Pass the Interplanetary Accord and ensure clean energy access for every citizen.',
      schedule: JSON.stringify({
        morning: '09:00 - 12:00: Presiding over Arcadian Parliamentary sessions',
        afternoon: '13:30 - 16:30: Meeting delegation leaders and reviewing budget proposals',
        evening: '17:30 - 20:00: Public town hall address in Nexus Central Plaza'
      }),
      avatar: '/img/avatars/npc_marcus.png'
    },
    {
      name: 'Aria Solis',
      age: 26,
      gender: 'Female',
      occupation: 'Chief Editor of The Veridian Chronicle',
      personality: 'Sharp-witted, relentless truth-seeker with an eye for dramatic human stories and planetary milestones.',
      background: 'Award-winning investigative reporter who established the first autonomous planetary press syndicate.',
      goals: 'Deliver completely impartial daily news coverage directly from authoritative database records.',
      schedule: JSON.stringify({
        morning: '07:30 - 11:00: Reviewing overnight planetary crime, market, and social logs',
        afternoon: '12:00 - 16:00: Conducting interviews with pioneers and business magnates',
        evening: '17:00 - 20:00: Publishing the evening edition of The Veridian Chronicle'
      }),
      avatar: '/img/avatars/npc_aria.png'
    },
    {
      name: 'Kaelen Voss',
      age: 34,
      gender: 'Male',
      occupation: 'Founder of Apex Cybernetics',
      personality: 'Pragmatic, ambitious, enthusiastic entrepreneur who loves trading and inventing hardware.',
      background: 'Apprentice tinkerer who rose to become the premier hardware merchant in Solaris Basin.',
      goals: 'Supply cutting-edge neural visors and exosuits across the entire galaxy.',
      schedule: JSON.stringify({
        morning: '08:30 - 12:00: Overseeing product fabrication at Apex Manufacturing Lab',
        afternoon: '13:00 - 17:30: Managing the marketplace exchange and customer shipments',
        evening: '18:00 - 21:30: Networking with new entrepreneurs at the Starlight Observatory'
      }),
      avatar: '/img/avatars/npc_kaelen.png'
    }
  ];

  for (const npc of npcs) {
    await query(`
      INSERT INTO npc_characters (planet_id, country_id, city_id, name, age, gender, occupation, personality, background, goals, schedule_json, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT DO NOTHING;
    `, [
      planetId,
      countryId,
      city1Id,
      npc.name,
      npc.age,
      npc.gender,
      npc.occupation,
      npc.personality,
      npc.background,
      npc.goals,
      npc.schedule,
      npc.avatar
    ]);
  }

  // 10. Starter Businesses & Products
  const bizRes = await query(`
    INSERT INTO businesses (planet_id, country_id, city_id, owner_profile_id, name, category, description, capital, revenue, reputation)
    VALUES ($1, $2, $3, $4, 'Apex Cybernetics Emporium', 'Technology', 'Premier supplier of cybernetic implants, neural optics, and titanium frames.', 25000.00, 8420.00, 92)
    RETURNING id;
  `, [planetId, countryId, city1Id, adminProfileId]);
  const bizId = bizRes.rows[0].id;

  const prodRes1 = await query(`
    INSERT INTO products (business_id, name, category, description, cost_price, selling_price, stock_quantity, quality_rating)
    VALUES 
      ($1, 'Neural Interface Visor Mk.II', 'Hardware', 'Holographic ocular visor offering enhanced augmented telemetry.', 50.00, 120.00, 45, 4.8),
      ($1, 'Titanium Exosuit Frame', 'Wearable', 'Lightweight combat and heavy construction kinetic framework.', 180.00, 350.00, 20, 4.9),
      ($1, 'Synthetic Bio-Gel Pack', 'Medical', 'Rapid cellular reconstruction gel for trauma and fatigue.', 8.00, 25.00, 150, 4.6),
      ($1, 'Veridian Chrono-Compass', 'Exploration', 'Quantum navigational beacon synced with planetary binary stars.', 35.00, 85.00, 60, 4.7)
    RETURNING id;
  `, [bizId]);

  // Marketplace listings
  for (const prodRow of prodRes1.rows) {
    await query(`
      INSERT INTO marketplace_listings (seller_profile_id, planet_id, product_id, title, description, price, quantity, status)
      VALUES ($1, $2, $3, 'Official Emporium Stock', 'Guaranteed manufacturer grade item with warranty.', 120.00, 5, 'active')
    `, [adminProfileId, planetId, prodRow.id]);
  }

  // 11. Government, Parties & Laws
  await query(`
    INSERT INTO governments (country_id, leader_profile_id, leader_name, form, budget)
    VALUES ($1, $2, 'Marcus Thorne (Council President)', 'Democratic Technocracy', 3500000.00)
    ON CONFLICT (country_id) DO NOTHING;
  `, [countryId, adminProfileId]);

  await query(`
    INSERT INTO political_parties (country_id, name, abbreviation, ideology, members_count)
    VALUES 
      ($1, 'Techno-Progressive Coalition', 'TPC', 'Accelerated scientific research, automated civil infrastructure, open space exploration.', 1420),
      ($1, 'Veridian Sovereign Alliance', 'VSA', 'Planetary self-sufficiency, ecosystem preservation, cautious contact policies.', 980)
  `, [countryId]);

  await query(`
    INSERT INTO laws (country_id, title, description, category, status)
    VALUES 
      ($1, 'Universal Citizen Basic Dividend Act', 'Guarantees every active citizen a baseline allowance upon completing civic registration.', 'Economic', 'enacted'),
      ($1, 'Fair Interplanetary Commerce Protocol', 'Regulates tariffs, prevents currency manipulation, and enforces consumer safety standards.', 'Economic', 'enacted'),
      ($1, 'Planetary Atmosphere Protection Accord', 'Prohibits atmospheric strip-mining and restricts orbital heavy propulsion near urban zones.', 'Public Works', 'enacted')
  `, [countryId]);

  // Active Election
  await query(`
    INSERT INTO elections (country_id, title, position, status, end_date)
    VALUES ($1, 'General Planetary Council Election 2185', 'Council President', 'active', CURRENT_TIMESTAMP + INTERVAL '30 days')
  `, [countryId]);

  // 12. Lounges & Public Channels
  await query(`
    INSERT INTO lounges (planet_id, city_id, name, category, description, is_private, capacity, current_occupants)
    VALUES 
      ($1, $2, 'Nexus Central Cyber-Lounge', 'Cyber Lounge', 'The premier neon lounge overlooking Aethel City central plaza. Live holograms and chill beats.', FALSE, 100, 14),
      ($1, $3, 'The Starlight Observatory Hub', 'Science Hub', 'Cosy discussion lounge for astronomers, navigators, and explorers.', FALSE, 50, 8),
      ($1, $2, 'Traders Syndicate Exchange Room', 'Traders Guild', 'Exclusive meeting room for company founders and market brokers.', FALSE, 40, 5)
  `, [planetId, city1Id, city2Id]);

  // Public Chat Conversations
  const convGlobal = await query(`
    INSERT INTO conversations (type, title, planet_id)
    VALUES ('channel', 'Global Holo-Net (Veridia Prime)', $1)
    RETURNING id;
  `, [planetId]);

  await query(`
    INSERT INTO messages (conversation_id, sender_name, content, is_system)
    VALUES 
      ($1, 'Veridia Central Net', 'Welcome to Veridia Prime. Quantum Holonet link established. Transmit respectfully.', TRUE),
      ($1, 'Aria Solis', 'Greetings citizens! Welcome to Aethel City. The Veridian Chronicle evening edition is now on stands.', FALSE)
  `, [convGlobal.rows[0].id]);

  // 13. Achievements
  const achievements = [
    ['FIRST_STEP', 'Awakening on Veridia', 'Complete character creation and arrive in your starting city.', 'General', 'bi-compass-fill', 50],
    ['FIRST_CREDIT', 'Financial Independence', 'Earn your first 500 Credits through work, business, or commerce.', 'Economy', 'bi-cash-coin', 75],
    ['SOCIALITE', 'Citizen of the Stars', 'Connect with 3 friends and participate in a public lounge.', 'Social', 'bi-people-fill', 100],
    ['SCHOLAR', 'Master of Knowledge', 'Enroll in an academy and graduate with honors.', 'Education', 'bi-mortarboard-fill', 150],
    ['TYCOON', 'Industrial Visionary', 'Register a corporation and list your first commercial product.', 'Business', 'bi-building-fill', 200],
    ['STATESMAN', 'Architect of Democracy', 'Cast a validated ballot in a presidential or parliamentary election.', 'Government', 'bi-fingerprint', 100],
    ['EXPLORER', 'Planetary Cartographer', 'Visit both Aethel City and Nova Haven.', 'Exploration', 'bi-globe-americas', 125]
  ];

  for (const [code, title, desc, cat, icon, pts] of achievements) {
    await query(`
      INSERT INTO achievements (code, title, description, category, icon, points)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (code) DO NOTHING;
    `, [code, title, desc, cat, icon, pts]);
  }

  // 14. Starter Dynamic Missions
  await query(`
    INSERT INTO missions (category, title, description, requirements, xp_reward, currency_reward, rep_reward)
    VALUES 
      ('Social', 'Civic Induction & Social Net', 'Introduce yourself to the planetary network by posting your first status update.', '{"type": "post", "count": 1}', 100, 50.00, 15),
      ('Education', 'Academic Enrollment', 'Visit an academy in Aethel City or Nova Haven and register for an accredited course.', '{"type": "enroll", "count": 1}', 200, 75.00, 20),
      ('Employment', 'Secure Professional Employment', 'Apply for and obtain an active position in engineering, commerce, or government.', '{"type": "job", "count": 1}', 250, 150.00, 30),
      ('Government', 'Democratic Participation', 'Review the candidate platforms in the elections portal and submit your vote.', '{"type": "vote", "count": 1}', 150, 60.00, 25),
      ('Business', 'Enter the Open Market', 'Purchase an item from the marketplace or register your own enterprise.', '{"type": "market", "count": 1}', 300, 200.00, 40)
  `);

  // 15. World History & Newspaper Grounded in DB Events
  await query(`
    INSERT INTO historical_records (planet_id, world_year, world_day, category, headline, article)
    VALUES 
      ($1, 2185, 1, 'milestone', 'The Dawn of Veridia Prime', 'The first colony ships arrived in Solaris Basin, establishing the foundation of Aethel City.'),
      ($1, 2185, 45, 'government', 'Constitution of Neo-Arcadia Ratified', 'Delegates from all pioneering districts convened to enact the Charter of Cyber-Democracy.'),
      ($1, 2185, 100, 'economy', 'Planetary Credit Clearinghouse Launched', 'The Ministry of Finance activated the decentralized wallet ledger, standardizing the planetary Credit (₡).'),
      ($1, 2185, 142, 'culture', 'The Veridian Chronicle Inaugural Edition', 'Editor Aria Solis announces planetary automated news reporting, directly syncing real citizen achievements to the historic record.')
  `, [planetId]);

  // Starter Social Post
  await query(`
    INSERT INTO social_posts (profile_id, planet_id, content, hashtags, is_npc, likes_count, comments_count)
    VALUES 
      ($1, $2, 'The central quantum grid in Aethel City is running at peak capacity. Welcome all new arrivals to Veridia Prime! #VeridiaAwakens #FutureIsNow', '{"VeridiaAwakens", "FutureIsNow"}', TRUE, 42, 5),
      ($1, $2, 'Remember to cast your vote in the ongoing Senate election. Every citizen shapes the laws of Neo-Arcadia. #DemocracyInAction', '{"DemocracyInAction"}', TRUE, 29, 3)
  `, [adminProfileId, planetId]);

  console.log('[SEED] Universe seeding completed successfully!');
}

// Allow running directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SEED] Seeding failed:', err);
      await closeDb();
      process.exit(1);
    });
}

