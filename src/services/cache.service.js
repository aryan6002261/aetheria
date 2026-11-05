import Redis from 'ioredis';
import { config } from '../config/config.js';

let redisClient = null;
const memoryStore = new Map();
const memoryExpiry = new Map();

export function initCache() {
  if (config.redisUrl) {
    try {
      console.log('[CACHE] Connecting to Redis at:', config.redisUrl);
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      redisClient.connect().then(() => {
        console.log('[CACHE] Redis connected successfully.');
      }).catch(err => {
        console.warn('[CACHE] Redis connection failed. Falling back to in-memory store:', err.message);
        redisClient = null;
      });
    } catch (err) {
      console.warn('[CACHE] Redis init error, using in-memory store:', err.message);
      redisClient = null;
    }
  } else {
    console.log('[CACHE] Using high-performance in-memory cache.');
  }
}

export async function getCache(key) {
  if (redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      // Fallback
    }
  }

  // Check in-memory store
  if (memoryExpiry.has(key) && memoryExpiry.get(key) < Date.now()) {
    memoryStore.delete(key);
    memoryExpiry.delete(key);
    return null;
  }
  return memoryStore.get(key) || null;
}

export async function setCache(key, value, ttlSeconds = 300) {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch {
      // Fallback
    }
  }

  memoryStore.set(key, value);
  if (ttlSeconds > 0) {
    memoryExpiry.set(key, Date.now() + (ttlSeconds * 1000));
  }
}

export async function delCache(key) {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch {}
  }
  memoryStore.delete(key);
  memoryExpiry.delete(key);
}

export default {
  initCache,
  getCache,
  setCache,
  delCache,
};
