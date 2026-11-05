import app from '../src/app.js';
import http from 'node:http';
import { closeDb } from '../src/db/db.js';

async function testWebsitePages() {
  console.log('🧪 Verifying Clean Website & Pages Resolution...');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const pagesToTest = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/character-create.html',
    '/social.html',
    '/chat.html',
    '/wallet.html',
    '/marketplace.html',
    '/business.html',
    '/career.html',
    '/education.html',
    '/family.html',
    '/government.html',
    '/elections.html',
    '/missions.html',
    '/newspaper.html',
    '/map.html',
    '/explorer.html',
    '/lounges.html',
    '/profile.html',
    '/settings.html',
    '/notifications.html',
    '/admin.html',
    '/css/style.css',
    '/js/api.js',
    '/js/navbar.js'
  ];

  try {
    for (const page of pagesToTest) {
      const res = await fetch(`${baseUrl}${page}`);
      if (res.status !== 200) {
        throw new Error(`Failed to load ${page}, status: ${res.status}`);
      }
      console.log(`   ✅ ${page.padEnd(25)} -> HTTP 200 OK (${res.headers.get('content-type')})`);
    }

    console.log('\n🎉 ALL 26 CORE WEBSITE ASSETS & PAGES RESOLVED WITH HTTP 200 OK!');
  } finally {
    server.close();
    await closeDb();
  }
}

testWebsitePages().catch((err) => {
  console.error('❌ Page verification failed:', err);
  process.exit(1);
});

