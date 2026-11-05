import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();

const defaultPgData = 'C:/Users/aryan/.gemini/antigravity/brain/9f60b90d-049c-40bd-b175-d8f76920a742/scratch/pgdata';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'aetheria_default_secret_key_change_me',
  sessionSecret: process.env.SESSION_SECRET || 'aetheria_session_cookie_secret',
  databaseUrl: process.env.DATABASE_URL || null,
  pgDataDir: process.env.PGDATA_DIR || defaultPgData,
  redisUrl: process.env.REDIS_URL || null,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  uploadDir: process.env.UPLOAD_DIR || './public/uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
};
