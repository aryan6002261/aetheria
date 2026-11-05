import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, exec, closeDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('[MIGRATE] Initializing database connection...');
  await initDb();

  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`[MIGRATE] Reading schema from: ${schemaPath}`);
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[MIGRATE] Applying database schema migrations...');
  await exec(sql);

  // Apply schema evolution column additions if existing tables were initialized previously
  console.log('[MIGRATE] Ensuring schema column evolution (countries, player_profiles, pets)...');
  await exec(`
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS leader_title VARCHAR(50) DEFAULT 'Prime Minister';
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS leader_name VARCHAR(100) DEFAULT 'Leader';
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS constitution_title VARCHAR(150);
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS constitution_text TEXT;
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag_emoji VARCHAR(10) DEFAULT '🏛️';
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS map_x INTEGER DEFAULT 200;
    ALTER TABLE countries ADD COLUMN IF NOT EXISTS map_y INTEGER DEFAULT 200;

    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS wealth_tier VARCHAR(30) DEFAULT 'working_class';
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS hair_color VARCHAR(30) DEFAULT 'Brown';
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS hair_style VARCHAR(30) DEFAULT 'Short Wavy';
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS eye_color VARCHAR(30) DEFAULT 'Brown';
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS skin_tone VARCHAR(30) DEFAULT 'Medium';
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS height_cm INTEGER DEFAULT 170;
    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS build VARCHAR(30) DEFAULT 'Average';
  `);

  console.log('[MIGRATE] Database schema migrations completed successfully!');
}

// Allow running directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[MIGRATE] Migration failed:', err);
      await closeDb();
      process.exit(1);
    });
}

