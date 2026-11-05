import { initDb, query, closeDb } from './db.js';

export async function seedDatabase() {
  console.log('[SEED] Starting universe seed for Planet Aethel...');
  await initDb();

  // 1. Galaxy
  const galaxyRes = await query(`
    INSERT INTO galaxies (name, description, coordinates)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id;
  `, ['Solaris-Prime Galaxy', 'The cradle of post-solar human civilization and habitable planetary systems.', '001, 108, 442']);
  const galaxyId = galaxyRes.rows[0].id;

  // 2. Primary Planet: Aethel
  const planetRes = await query(`
    INSERT INTO planets (galaxy_id, name, slug, description, currency_name, currency_symbol, population, is_discovered, day_cycle, world_year, world_day, timeline_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (slug) DO UPDATE SET 
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      population = EXCLUDED.population
    RETURNING id;
  `, [
    galaxyId,
    'Aethel',
    'aethel',
    'A vast, beautiful terrestrial world of lush continents, vibrant ocean trade, distinct human nations, and historic civilizations.',
    'Credits',
    '₡',
    124800,
    true,
    24,
    2026,
    1,
    'Era of Peace & Global Commerce'
  ]);
  const planetId = planetRes.rows[0].id;

  // 3. Five Distinct Countries on Planet Aethel (Monarchy, Democracy, Technocracy, Social Republic, Sultanate)
  const countriesData = [
    {
      name: 'The Kingdom of Eldoria',
      code: 'ELD',
      description: 'A historic realm blending aristocratic tradition, stone castles, and modern infrastructure. Deeply reveres knightly virtue, heritage, and the Crown.',
      capital_city: "Crown's Landing",
      tax_rate: 8.00,
      treasury_balance: 3200000.00,
      government_type: 'Constitutional Monarchy',
      leader_title: 'His Majesty King',
      leader_name: 'King Alden IV',
      constitution_title: 'The Royal Charter & Magna Carta of Eldoria',
      constitution_text: 'PREAMBLE: We, the Crown and Free Estates of Eldoria, decree the sovereign dignity of all folk under the Royal Seal.\n\nARTICLE I: The Crown reigns as constitutional protector; the High Council and Parliament enact statute law.\nARTICLE II: Freedom of the press, assembly, and fair trial before the Crown Court are guaranteed to all subjects.\nARTICLE III: Knightly and civic orders reward outstanding national service; income tax is fixed at 8.0% for civil defense and royal public works.',
      flag_emoji: '👑',
      map_x: 230,
      map_y: 170
    },
    {
      name: 'The Republic of Solaria',
      code: 'SOL',
      description: 'A bustling, open federal democracy centered on individual liberties, vibrant digital enterprise, and competitive free markets.',
      capital_city: 'Sol-Centrum',
      tax_rate: 10.00,
      treasury_balance: 4800000.00,
      government_type: 'Federal Representative Democracy',
      leader_title: 'President',
      leader_name: 'Lyra Thorne',
      constitution_title: 'The Constitution of the Republic of Solaria',
      constitution_text: 'PREAMBLE: We the People of Solaria, to establish liberty, foster innovation, and secure equal justice under law...\n\nARTICLE I: Legislative authority is vested in a bicameral Congress and Senate, elected every four years.\nARTICLE II: Every citizen holds the inviolable right to free speech, peaceful assembly, universal voting, and privacy.\nARTICLE III: Commerce is governed by fair competition laws, with a standard 10.0% tax rate funding civic infrastructure.',
      flag_emoji: '🏛️',
      map_x: 480,
      map_y: 240
    },
    {
      name: 'The Meritocratic Technocracy of Cyrene',
      code: 'CYR',
      description: 'A high-technology coastal nation governed by scientists, educators, and engineers where policy is determined through empirical research.',
      capital_city: 'Nexus Prime',
      tax_rate: 12.00,
      treasury_balance: 5100000.00,
      government_type: 'Meritocratic Technocracy',
      leader_title: 'High Chancellor',
      leader_name: 'Dr. Viktor Vance',
      constitution_title: 'The Articles of Rational Governance',
      constitution_text: 'PREAMBLE: Knowledge, empirical research, and demonstrated capability shall steer public policy.\n\nARTICLE I: Executive ministers must hold verified credentials in their relevant scientific or administrative disciplines.\nARTICLE II: Universal education is fully state-funded from early childhood to postdoctoral levels.\nARTICLE III: Tax revenues (12.0%) are dedicated primarily to automation, clean energy, universal healthcare, and public research.',
      flag_emoji: '🔬',
      map_x: 720,
      map_y: 150
    },
    {
      name: 'The Commonwealth of Valona',
      code: 'VAL',
      description: 'A peaceful, forest-fringed social democracy committed to universal welfare, environmental stewardship, and citizen happiness.',
      capital_city: 'Aurora Glen',
      tax_rate: 14.50,
      treasury_balance: 2900000.00,
      government_type: 'Parliamentary Social Democracy',
      leader_title: 'Prime Minister',
      leader_name: 'Sarah Jenkins',
      constitution_title: 'The Valonian Social Compact',
      constitution_text: 'PREAMBLE: A commonwealth that protects its vulnerable and cherishes the natural world shall prosper endlessly.\n\nARTICLE I: Parliament serves as custodian of public welfare, with decisions guided by universal citizen well-being.\nARTICLE II: Every resident has a fundamental right to dignified housing, medical care, and lifelong education.\nARTICLE III: Progressive tax of 14.5% maintains lush national parks, state hospitals, and clean transport.',
      flag_emoji: '🌿',
      map_x: 320,
      map_y: 390
    },
    {
      name: 'The Grand Sultanate of Zephyria',
      code: 'ZEP',
      description: 'A wealthy desert and coastal merchant realm famed for spice routes, grand bazaars, architectural wonders, and sovereign merchant guilds.',
      capital_city: 'Al-Miraj',
      tax_rate: 5.00,
      treasury_balance: 6200000.00,
      government_type: 'Hereditary Sultanate & Mercantile Guilds',
      leader_title: 'His Eminence Sultan',
      leader_name: 'Tariq Al-Mansur',
      constitution_title: 'The Zephyrian Sovereign Decree & Guild Compact',
      constitution_text: 'PREAMBLE: By ancient honor, desert hospitality, and the sovereign word of the Sultanate.\n\nARTICLE I: The Sultan guides defense, high justice, and foreign relations; the Grand Guild of Merchants governs commerce and trade.\nARTICLE II: Absolute sanctity of private property, sacred contracts, and zero tariffs on raw food staples.\nARTICLE III: A flat 5.0% civic duty is levied on commercial profits, leaving merchant enterprise free to flourish.',
      flag_emoji: '🌙',
      map_x: 600,
      map_y: 390
    }
  ];

  const countryIds = {};
  for (const c of countriesData) {
    const res = await query(`
      INSERT INTO countries (
        planet_id, name, code, description, capital_city, tax_rate, 
        treasury_balance, government_type, leader_title, leader_name, 
        constitution_title, constitution_text, flag_emoji, map_x, map_y
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (planet_id, name) DO UPDATE SET 
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        tax_rate = EXCLUDED.tax_rate,
        government_type = EXCLUDED.government_type,
        leader_title = EXCLUDED.leader_title,
        leader_name = EXCLUDED.leader_name,
        constitution_title = EXCLUDED.constitution_title,
        constitution_text = EXCLUDED.constitution_text,
        flag_emoji = EXCLUDED.flag_emoji,
        map_x = EXCLUDED.map_x,
        map_y = EXCLUDED.map_y
      RETURNING id;
    `, [
      planetId, c.name, c.code, c.description, c.capital_city, c.tax_rate,
      c.treasury_balance, c.government_type, c.leader_title, c.leader_name,
      c.constitution_title, c.constitution_text, c.flag_emoji, c.map_x, c.map_y
    ]);
    countryIds[c.name] = res.rows[0].id;
  }

  // 4. Regions and Cities for Each Nation
  const citiesData = [
    // Eldoria
    { country: 'The Kingdom of Eldoria', region: 'Crownlands', city: "Crown's Landing", desc: "The ancient capital of kings, with grand stone bridges and royal courts.", pop: 35000 },
    { country: 'The Kingdom of Eldoria', region: 'Crownlands', city: 'Oakhaven', desc: 'A peaceful timber and agricultural city surrounding the Great Forest.', pop: 12000 },
    // Solaria
    { country: 'The Republic of Solaria', region: 'Federal Valley', city: 'Sol-Centrum', desc: 'A gleaming metropolitan capital of commerce, law, and congress.', pop: 48000 },
    { country: 'The Republic of Solaria', region: 'Federal Valley', city: 'Verdant Bay', desc: 'A coastal resort and shipping harbor bustling with trading vessels.', pop: 18000 },
    // Cyrene
    { country: 'The Meritocratic Technocracy of Cyrene', region: 'Research Peninsula', city: 'Nexus Prime', desc: 'The high-tech city of laboratories, universities, and data academies.', pop: 29000 },
    { country: 'The Meritocratic Technocracy of Cyrene', region: 'Research Peninsula', city: 'Quantum Valley', desc: 'A suburban enclave dedicated to clean microchip fabrication and bio-tech.', pop: 14000 },
    // Valona
    { country: 'The Commonwealth of Valona', region: 'Highland Woods', city: 'Aurora Glen', desc: 'A garden city with solar transit, public plazas, and community houses.', pop: 22000 },
    { country: 'The Commonwealth of Valona', region: 'Highland Woods', city: 'Lakeshire', desc: 'A lakeside city known for craftsmanship, sustainable farming, and art.', pop: 11000 },
    // Zephyria
    { country: 'The Grand Sultanate of Zephyria', region: 'Amber Coast', city: 'Al-Miraj', desc: 'The golden capital of vaulted palaces, spice markets, and guild houses.', pop: 38000 },
    { country: 'The Grand Sultanate of Zephyria', region: 'Amber Coast', city: 'Duneport', desc: 'A deepwater harbor exporting rare silks, dates, gems, and glassware.', pop: 16000 }
  ];

  const cityIds = {};
  for (const item of citiesData) {
    const cId = countryIds[item.country];
    let regRes = await query(`
      INSERT INTO regions (country_id, name, climate)
      VALUES ($1, $2, 'Temperate Habitable')
      RETURNING id;
    `, [cId, item.region]);
    const rId = regRes.rows[0].id;

    let cityRes = await query(`
      INSERT INTO cities (region_id, country_id, name, description, population)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `, [rId, cId, item.city, item.desc, item.pop]);
    cityIds[item.city] = cityRes.rows[0].id;
  }

  // 5. Realistic Human Skills
  const skillsList = [
    ['Reading & Language', 'Academic', 'Literacy, grammar, storytelling, and comprehension.', 100],
    ['Mathematics & Logic', 'Academic', 'Arithmetic, algebra, problem solving, and analytical thinking.', 100],
    ['Computer Programming', 'Technical', 'Writing software, web development, and digital tools.', 100],
    ['Medical Science', 'Professional', 'First aid, human anatomy, pathology, and clinical care.', 100],
    ['Engineering & Design', 'Technical', 'Mechanical design, architecture, and structural physics.', 100],
    ['Business & Commerce', 'Commerce', 'Accounting, negotiations, marketing, and entrepreneurship.', 100],
    ['Civics & Law', 'Governance', 'Constitutional law, public policy, and democratic ethics.', 100],
    ['Visual Arts & Music', 'Artistic', 'Drawing, musical composition, and creative expression.', 100],
    ['Physical Fitness', 'Physical', 'Endurance, athletic agility, and bodily wellness.', 100]
  ];

  for (const [name, cat, desc, maxLvl] of skillsList) {
    await query(`
      INSERT INTO skills (name, category, description, max_level)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING;
    `, [name, cat, desc, maxLvl]);
  }

  // 6. Educational Institutions
  const primaryCityId = cityIds["Crown's Landing"] || 1;
  const solariaCityId = cityIds['Sol-Centrum'] || 1;
  const cyreneCityId = cityIds['Nexus Prime'] || 1;

  await query(`
    INSERT INTO education_institutions (city_id, name, type, description, tuition_fee, reputation)
    VALUES 
      ($1, 'Crown Primary Grammar School', 'Primary School', 'State-accredited elementary education providing foundation reading, math, and morals.', 0.00, 85),
      ($2, 'Solaria Central Elementary', 'Primary School', 'Innovative primary school encouraging curiosity, social play, and science.', 0.00, 88),
      ($1, 'Eldoria Royal High School', 'High School', 'Prestigious secondary school preparing teens for civic service and higher study.', 150.00, 90),
      ($2, 'Sol-Centrum College Preparatory', 'High School', 'Comprehensive high school with vocational and university tracks.', 200.00, 92),
      ($3, 'Cyrene Institute of Technology', 'University', 'World-leading university in computer science, robotics, and medical research.', 1200.00, 98),
      ($2, 'National University of Solaria', 'University', 'Renowned school of business, law, liberal arts, and government.', 1000.00, 95)
    ON CONFLICT DO NOTHING;
  `, [primaryCityId, solariaCityId, cyreneCityId]);

  // 7. Careers Across Life Stages
  await query(`
    INSERT INTO jobs (country_id, title, category, base_salary, description)
    VALUES 
      -- Teenage & Entry Level Jobs
      ($1, 'Library Assistant', 'Education', 45.00, 'Assisting visitors and archiving scrolls and books.'),
      ($1, 'Apprentice Baker', 'Culinary', 50.00, 'Baking fresh breads and pastries for the community.'),
      ($1, 'Local Courier', 'Transportation', 55.00, 'Delivering parcels and messages across districts.'),
      -- Adult Careers
      ($1, 'Software Developer', 'Technology', 180.00, 'Building civic registries and computational tools.'),
      ($1, 'Staff Physician', 'Medical', 260.00, 'Providing clinical healthcare and treatments.'),
      ($1, 'Civil Servant', 'Governance', 140.00, 'Managing municipal permits, tax records, and public filings.'),
      ($1, 'Accountant', 'Commerce', 160.00, 'Managing treasury ledgers and auditing commercial statements.'),
      ($1, 'Primary School Teacher', 'Education', 135.00, 'Teaching foundational literacy and mathematics to young citizens.'),
      ($1, 'Royal Architectural Craftsman', 'Engineering', 210.00, 'Designing civic buildings and public bridges.')
    ON CONFLICT DO NOTHING;
  `, [countryIds['The Kingdom of Eldoria']]);

  // 8. AI NPCs (Persistent Human Citizens)
  await query(`
    INSERT INTO npc_characters (planet_id, country_id, city_id, name, age, gender, occupation, personality, background, goals, schedule_json)
    VALUES 
      ($1, $2, $3, 'Master Arthur Vance', 48, 'Male', 'Royal Archivist & Teacher', 'Scholarly, encouraging, and deeply respectful of history.', 'Has served 20 years guiding students and preserving the legal scrolls of Eldoria.', 'Educate the youth in reading and history.', '{"morning": "Library archives", "afternoon": "Teaching class", "evening": "Writing chronicle"}'),
      ($1, $2, $3, 'Dr. Clara Thorne', 34, 'Female', 'Community Doctor', 'Compassionate, focused, and attentive to public health.', 'Grew up in Oakhaven and trained in general medicine to care for neighborhood families.', 'Protect public health and heal citizens.', '{"morning": "Clinic rounds", "afternoon": "Patient consultations", "evening": "Community center"}'),
      ($1, $2, $3, 'Jonathan Miller', 29, 'Male', 'Town Merchant & Shopkeeper', 'Cheerful, fair-minded, and sharp with arithmetic.', 'Runs the Central Market Trading Post, buying and selling local foodstuffs and goods.', 'Maintain honest trade and support local producers.', '{"morning": "Opening stalls", "afternoon": "Trading goods", "evening": "Balancing ledger"}'),
      ($1, $2, $3, 'Lady Beatrice Howard', 56, 'Female', 'Crown Magistrate & Legal Scholar', 'Fair, dignified, and steadfast in upholding constitutional rights.', 'Appointed by the Royal Council to oversee civic contracts and property transfers.', 'Ensure constitutional justice is accessible to all.', '{"morning": "Crown Court", "afternoon": "Reviewing petitions", "evening": "Reading law"}')
    ON CONFLICT DO NOTHING;
  `, [planetId, countryIds['The Kingdom of Eldoria'], primaryCityId]);

  // 9. Initial Real-Life Newspaper Edition
  await query(`
    INSERT INTO historical_records (planet_id, world_year, world_day, category, headline, article)
    VALUES 
      ($1, 2026, 1, 'culture', 'The Aethel Gazette · Global Edition #1', 'CONCORD ACROSS AETHEL: The five nations of planet Aethel celebrate the Annual Solstice Treaty. King Alden IV of Eldoria and President Thorne of Solaria proclaim mutual open borders for merchant shipping and cultural exchange. Elementary schools open enrollment for the new academic cycle.'),
      ($1, 2026, 1, 'milestone', 'New Academic Cycle Commences Across All Nations', 'Primary schools and high schools across all five countries report record enrollment as young citizens embark on their educational journey.')
    ON CONFLICT DO NOTHING;
  `, [planetId]);

  console.log('[SEED] Planet Aethel universe seed completed successfully!');
}

// Allow running directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SEED] Seed failed:', err);
      await closeDb();
      process.exit(1);
    });
}
