import app from '../src/app.js';
import { initDb } from '../src/db/db.js';

let isReady = false;

/**
 * Vercel Serverless Function Entrypoint
 * Automatically establishes database connectivity on cold start and delegates to Express.
 */
export default async function handler(req, res) {
  if (!isReady) {
    try {
      await initDb();
      isReady = true;
    } catch (err) {
      console.error('[VERCEL HANDLER] Database initialization warning:', err.message);
    }
  }
  return app(req, res);
}

