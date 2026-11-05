import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/config.js';

let pgPool = null;
let pgliteInstance = null;
let isConnected = false;

export async function initDb() {
  if (isConnected) return;

  if (config.databaseUrl) {
    console.log('[DB] Connecting to PostgreSQL via DATABASE_URL...');
    const isLocalhost = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');
    pgPool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: process.env.VERCEL ? 3 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    // Test connection
    try {
      const client = await pgPool.connect();
      client.release();
      isConnected = true;
      console.log('[DB] Connected to PostgreSQL successfully.');
      await ensureSchemaAndSeed();
      return;
    } catch (err) {
      console.warn('[DB] Could not connect to DATABASE_URL. Falling back to persistent PGlite engine:', err.message);
      pgPool = null;
    }
  }

  // Fallback / Default: Embedded PGlite
  const resolvedDir = path.resolve(config.pgDataDir);
  try {
    fs.mkdirSync(resolvedDir, { recursive: true });
  } catch (e) {
    // In read-only serverless filesystems if pgDataDir wasn't /tmp
    console.warn('[DB] mkdir warning for pgDataDir:', e.message);
  }

  console.log(`[DB] Initializing embedded persistent PostgreSQL engine at: ${resolvedDir}`);
  pgliteInstance = new PGlite(resolvedDir);
  await pgliteInstance.waitReady;
  isConnected = true;
  console.log('[DB] Embedded PostgreSQL (PGlite) engine is ready and active.');

  await ensureSchemaAndSeed();
}

/**
 * Automatically provisions tables and initial universe seed if the database is newly created
 */
async function ensureSchemaAndSeed() {
  try {
    const checkRes = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'planets';
    `);

    if (!checkRes.rows || checkRes.rows.length === 0) {
      console.log('[DB] No database tables found. Running automated schema migration and universe seed...');
      const { runMigrations } = await import('./migrate.js');
      await runMigrations();
      const { seedDatabase } = await import('./seed.js');
      await seedDatabase();
      console.log('[DB] Automated universe setup complete.');
    }
  } catch (err) {
    console.warn('[DB] Schema check notice:', err.message);
  }
}

export async function query(text, params = []) {
  if (!isConnected) {
    await initDb();
  }

  if (pgPool) {
    const res = await pgPool.query(text, params);
    return { rows: res.rows || [], rowCount: res.rowCount || 0 };
  } else if (pgliteInstance) {
    const res = await pgliteInstance.query(text, params);
    return { rows: res.rows || [], rowCount: res.rowCount || (res.rows ? res.rows.length : 0) };
  } else {
    throw new Error('Database is not initialized');
  }
}

export async function exec(sql) {
  if (!isConnected) {
    await initDb();
  }

  if (pgPool) {
    return await pgPool.query(sql);
  } else if (pgliteInstance) {
    return await pgliteInstance.exec(sql);
  } else {
    throw new Error('Database is not initialized');
  }
}

export async function transaction(callback) {
  if (!isConnected) {
    await initDb();
  }

  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txClient = {
        query: (text, params) => client.query(text, params),
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else if (pgliteInstance) {
    return await pgliteInstance.transaction(async (tx) => {
      const txClient = {
        query: async (text, params) => {
          const res = await tx.query(text, params);
          return { rows: res.rows || [], rowCount: res.rowCount || (res.rows ? res.rows.length : 0) };
        },
      };
      return await callback(txClient);
    });
  }
}

export async function closeDb() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  isConnected = false;
  console.log('[DB] Database connection closed.');
}

export default {
  initDb,
  query,
  exec,
  transaction,
  closeDb,
};
