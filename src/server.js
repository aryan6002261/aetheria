import http from 'node:http';
import app from './app.js';
import { config } from './config/config.js';
import { initDb, closeDb } from './db/db.js';
import { initCache } from './services/cache.service.js';
import { initSocket } from './services/socket.service.js';
import { startSimulationWorker, stopSimulationWorker } from './services/simulation.service.js';

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

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

export { app, server };
