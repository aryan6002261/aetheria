import handler from '../api/index.js';
import http from 'node:http';
import { closeDb } from '../src/db/db.js';

async function testVercelHandler() {
  console.log('🧪 Testing Vercel Serverless Function Handler...');

  // Create mock HTTP server that routes requests directly through Vercel handler
  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log('1. Testing GET /api/world/universe via Vercel handler...');
    const universeRes = await fetch(`${baseUrl}/api/world/universe`);
    const universeData = await universeRes.json();
    console.log('   Universe response status:', universeRes.status);
    console.log('   Planets found:', universeData.planets?.length);
    if (!Array.isArray(universeData.planets) || universeData.planets.length === 0) {
      throw new Error('Vercel handler failed to return planets array.');
    }
    console.log('   ✅ Planetary data retrieved successfully through Vercel handler.');

    console.log('2. Testing GET /api/auth/config via Vercel handler...');
    const configRes = await fetch(`${baseUrl}/api/auth/config`);
    const configData = await configRes.json();
    console.log('   Config response:', configData);
    if (typeof configData.googleConfigured !== 'boolean') {
      throw new Error('Config endpoint failed through Vercel handler.');
    }
    console.log('   ✅ Auth config retrieved successfully through Vercel handler.');

    console.log('\n🎉 VERCEL SERVERLESS HANDLER VERIFICATION PASSED!');
  } finally {
    server.close();
    await closeDb();
  }
}

testVercelHandler().catch((err) => {
  console.error('❌ Vercel handler test failed:', err);
  process.exit(1);
});
