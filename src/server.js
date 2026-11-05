import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { config } from './config/config.js';
import { initDb, closeDb } from './db/db.js';
import { initCache } from './services/cache.service.js';
import { initSocket } from './services/socket.service.js';
import { startSimulationWorker, stopSimulationWorker } from './services/simulation.service.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import playerRoutes from './routes/player.routes.js';
import socialRoutes from './routes/social.routes.js';
import chatRoutes from './routes/chat.routes.js';
import worldRoutes from './routes/world.routes.js';
import educationRoutes from './routes/education.routes.js';
import careerRoutes from './routes/career.routes.js';
import economyRoutes from './routes/economy.routes.js';
import businessRoutes from './routes/business.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import governmentRoutes from './routes/government.routes.js';
import missionsRoutes from './routes/missions.routes.js';
import npcRoutes from './routes/npc.routes.js';
import assistantRoutes from './routes/assistant.routes.js';
import historyRoutes from './routes/history.routes.js';
import familyRoutes from './routes/family.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Security & Header Configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser(config.sessionSecret));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API Rate Limiter
app.use('/api', apiLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/world', worldRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/government', governmentRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/admin', adminRoutes);

// Fallback to index / landing page
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Server Initialization
async function startServer() {
  try {
    await initDb();
    initCache();
    startSimulationWorker(60000); // 1-minute tick for world calendar & simulation

    server.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`🌌 AETHERIA: PERSISTENT CIVILIZATION SIMULATOR ONLINE`);
      console.log(`🪐 Primary Planet: Veridia Prime (Andromeda-Sigma)`);
      console.log(`🚀 Gateway: ${config.appUrl}`);
      console.log(`⚡ Environment: ${config.nodeEnv}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received. Shutting down gracefully...');
  stopSimulationWorker();
  await closeDb();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('[SERVER] SIGINT received. Shutting down gracefully...');
  stopSimulationWorker();
  await closeDb();
  server.close(() => process.exit(0));
});

startServer();
