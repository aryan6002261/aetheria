import { initDb, query, closeDb } from '../src/db/db.js';
import app from '../src/app.js';
import http from 'node:http';

async function testGoogleAuth() {
  console.log('🧪 Starting Google Authentication Verification...');
  await initDb();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test GET /api/auth/config
    console.log('1. Testing GET /api/auth/config...');
    const configRes = await fetch(`${baseUrl}/api/auth/config`);
    const configJson = await configRes.json();
    console.log('   Response:', configJson);
    if (typeof configJson.googleConfigured !== 'boolean') {
      throw new Error('Config endpoint did not return googleConfigured boolean.');
    }
    console.log('   ✅ GET /api/auth/config passed.');

    // 2. Test POST /api/auth/google-direct (Register new Google user)
    console.log('2. Testing POST /api/auth/google-direct (First-time Gmail sign-in)...');
    const directRes = await fetch(`${baseUrl}/api/auth/google-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'astronomy_cadet@gmail.com',
        displayName: 'Cadet Lyra',
      }),
    });
    const directJson = await directRes.json();
    console.log('   Response:', { success: directJson.success, user: directJson.user, redirect: directJson.redirect });
    if (!directJson.success || directJson.user.email !== 'astronomy_cadet@gmail.com') {
      throw new Error('Google direct sign-in failed.');
    }
    if (directJson.redirect !== '/character-create.html') {
      throw new Error('Expected new citizen redirect to /character-create.html');
    }
    console.log('   ✅ First-time Google registration passed.');

    // 3. Verify user in database and auth provider
    console.log('3. Verifying database records for Google user...');
    const dbUser = await query('SELECT * FROM users WHERE email = $1;', ['astronomy_cadet@gmail.com']);
    if (dbUser.rows.length === 0) throw new Error('User not saved in database.');
    const dbProvider = await query('SELECT * FROM user_auth_providers WHERE user_id = $1;', [dbUser.rows[0].id]);
    if (dbProvider.rows.length === 0 || dbProvider.rows[0].provider !== 'google') {
      throw new Error('Provider not recorded as google.');
    }
    console.log('   ✅ Provider "google" verified in user_auth_providers.');

    // 4. Test re-login with the same Google user
    console.log('4. Testing repeat sign-in with existing Google account...');
    const reloginRes = await fetch(`${baseUrl}/api/auth/google-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'astronomy_cadet@gmail.com',
      }),
    });
    const reloginJson = await reloginRes.json();
    if (!reloginJson.success || reloginJson.user.id !== dbUser.rows[0].id) {
      throw new Error('Repeat sign-in failed.');
    }
    console.log('   ✅ Repeat Google sign-in recognized existing user identity.');

    console.log('\n🎉 ALL GOOGLE AUTHENTICATION TESTS PASSED!');
  } finally {
    server.close();
    await closeDb();
  }
}

testGoogleAuth().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

