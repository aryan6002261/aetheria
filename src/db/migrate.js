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

