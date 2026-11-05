import { query, closeDb } from '../src/db/db.js';
import playerRouter from '../src/routes/player.routes.js';
import { generateToken } from '../src/middleware/auth.js';

// Minimal mock express req/res
function mockReqRes(options = {}) {
  const req = {
    user: options.user || { id: 1, email: 'citizen@aethel.world', role: 'player', profile_id: options.profileId || 14 },
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    ip: '127.0.0.1'
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    }
  };

  return { req, res };
}

async function runPlayerRoutesTest() {
  console.log('🧪 Verifying Player Routes in Simulation...\n');

  try {
    // 1. Test /api/player/random-preview
    console.log('1. Testing GET /api/player/random-preview...');
    const randomRoute = playerRouter.stack.find(layer => layer.route && layer.route.path === '/random-preview' && layer.route.methods.get);
    if (!randomRoute) throw new Error('Route /random-preview not found.');

    const { req: rReq, res: rRes } = mockReqRes();
    const randomHandler = randomRoute.route.stack[randomRoute.route.stack.length - 1].handle;
    await randomHandler(rReq, rRes);

    const randomData = rRes.getData();
    console.log('   Suggested Name:', randomData.suggestedName);
    console.log('   Country:', `${randomData.flagEmoji} ${randomData.countryName} (${randomData.governmentType})`);
    console.log('   Family Wealth:', `${randomData.wealthLabel} (Starting: ₡${randomData.startingBalance})`);
    console.log('   Human Physical:', `${randomData.physical.hairColor} hair, ${randomData.physical.eyeColor} eyes, ${randomData.physical.skinTone} skin, ${randomData.physical.build} build`);
    console.log('   Pet Companion:', randomData.pet?.species ? `${randomData.pet.name} (${randomData.pet.species})` : 'None');
    console.log('   Starting Virtual Age:', randomData.virtualAge, `(${randomData.lifeStage})`);

    if (randomData.virtualAge !== 1) {
      throw new Error(`Expected starting virtual age 1, got ${randomData.virtualAge}`);
    }

    // 2. Test /api/player/live-day
    console.log('\n2. Testing POST /api/player/live-day...');
    const liveDayRoute = playerRouter.stack.find(layer => layer.route && layer.route.path === '/live-day' && layer.route.methods.post);
    if (!liveDayRoute) throw new Error('Route /live-day not found.');

    const profRes = await query("SELECT id FROM player_profiles LIMIT 1;");
    const testProfId = profRes.rows[0].id;

    const { req: lReq, res: lRes } = mockReqRes({
      profileId: testProfId,
      body: { actionId: 'learn_words' }
    });

    const liveHandler = liveDayRoute.route.stack[liveDayRoute.route.stack.length - 1].handle;
    await liveHandler(lReq, lRes);

    const liveData = lRes.getData();
    console.log('   Action Executed:', liveData.actionName);
    console.log('   Story Narrative:', liveData.story);
    console.log('   XP Gained:', liveData.gainedXp);
    console.log('   New Virtual Age:', liveData.newAge, `(${liveData.newStage})`);
    console.log('   Next Age Threshold:', liveData.nextXpNeeded, 'XP');

    if (!liveData.success) {
      throw new Error('live-day action failed: ' + JSON.stringify(liveData));
    }

    console.log('\n🎉 ALL PLAYER ROUTES & REAL-LIFE SIMULATION MECHANICS TESTED WITH ZERO ERRORS!');
  } finally {
    await closeDb();
  }
}

runPlayerRoutesTest().catch(err => {
  console.error('❌ Player routes test failed:', err);
  process.exit(1);
});
