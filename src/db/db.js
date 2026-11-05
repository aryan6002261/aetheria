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
    pgPool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Test connection
    try {
      const client = await pgPool.connect();
      client.release();
      isConnected = true;
      console.log('[DB] Connected to PostgreSQL successfully.');
      return;
    } catch (err) {
      console.warn('[DB] Could not connect to DATABASE_URL. Falling back to persistent PGlite engine:', err.message);
      pgPool = null;
    }
  }

  // Fallback / Default: Embedded PGlite
  const resolvedDir = path.resolve(config.pgDataDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  console.log(`[DB] Initializing embedded persistent PostgreSQL engine at: ${resolvedDir}`);
  pgliteInstance = new PGlite(resolvedDir);
  await pgliteInstance.waitReady;
  isConnected = true;
  console.log('[DB] Embedded PostgreSQL (PGlite) engine is ready and active.');
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

