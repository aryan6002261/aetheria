# Deploying Aetheria to Vercel

Aetheria is architected to run seamlessly on **Vercel** with zero-configuration serverless functions and ultra-fast static CDN hosting.

---

## 1. Quick Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login and Deploy**:
   ```bash
   vercel
   ```
   - When asked `Set up and deploy?`, select **`y`**.
   - Which scope do you want to deploy to? Select your account or team.
   - Link to existing project? Select **`N`**.
   - What's your project's name? `aetheria-simulator` (or your choice).
   - In which directory is your code located? `./`
   - Want to modify settings? Select **`N`**.

3. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

---

## 2. Deploy via GitHub / GitLab / Bitbucket (Vercel Dashboard)

1. Push your repository to GitHub:
   ```bash
   git push origin master
   ```
2. Navigate to [vercel.com/new](https://vercel.com/new).
3. Import your `game` repository.
4. Set the **Framework Preset** to **Other**.
5. Leave the Root Directory as `./`.
6. Click **Deploy**.

---

## 3. Database Options on Vercel

Vercel functions run in an ephemeral, serverless environment. You have two database options:

### Option A: Cloud Managed PostgreSQL (Recommended for Production)
Connect to any free/managed PostgreSQL provider (e.g. [Neon.tech](https://neon.tech), [Supabase.com](https://supabase.com), or Vercel Postgres):
1. In your Vercel Project Dashboard, navigate to **Settings** → **Environment Variables**.
2. Add:
   - `DATABASE_URL`: `postgresql://user:password@ep-cool-sample.us-east-2.aws.neon.tech/aetheria?sslmode=require`
3. **Automated Provisioning**: You do **not** need to manually run migrations. The first request to your Vercel deployment automatically detects a fresh database, builds all 59 tables, and seeds Veridia Prime, cities, academies, and NPCs!

### Option B: Zero-Config Embedded PGlite Fallback
If `DATABASE_URL` is omitted, Aetheria automatically initializes an embedded persistent PGlite engine inside `/tmp/aetheria_pgdata` in the serverless function environment.

---

## 4. Google OAuth 2.0 Configuration

Aetheria supports both **Instant Gmail Sign-In** (works immediately without any Google Cloud setup) and **Official Google One-Tap / Popup Sign-In**.

To enable official Google One-Tap:
1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Create or select a project.
3. Click **Create Credentials** → **OAuth client ID** → Application type: **Web application**.
4. Under **Authorized JavaScript Origins**, add:
   - `http://localhost:3000` (for local development)
   - `https://your-project.vercel.app` (your Vercel production domain)
5. Copy your **Client ID** (e.g., `1234567890-abc123xyz.apps.googleusercontent.com`).
6. In Vercel Project Settings → Environment Variables, add:
   - `GOOGLE_CLIENT_ID`: `<your_client_id>`
7. Redeploy (`vercel --prod`). The official Google One-Tap button will dynamically activate!

---

## 5. Environment Variables Reference

| Variable | Required | Description |
| :--- | :---: | :--- |
| `NODE_ENV` | Optional | Defaults to `production` on Vercel. |
| `DATABASE_URL` | Recommended | Remote PostgreSQL connection string (Neon, Supabase, Vercel Postgres). |
| `JWT_SECRET` | Recommended | Random secret string for signing session cookies. |
| `SESSION_SECRET` | Recommended | Secret string for cookie encryption. |
| `GOOGLE_CLIENT_ID` | Optional | Google Cloud OAuth 2.0 Web Client ID. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for dynamic AI NPCs & newspapers (procedural engine active if omitted). |

---

## 6. Architecture on Vercel

```
[Incoming Request]
       │
       ├─── / (or /index.html) ───────► Vercel Edge CDN (public/index.html)
       ├─── /dashboard.html ──────────► Vercel Edge CDN (public/dashboard.html)
       ├─── /css/*, /js/* ────────────► Vercel Edge CDN (Static Assets)
       │
       └─── /api/* ───────────────────► api/index.js (Serverless Function)
                                              │
                                              ▼
                                         src/app.js (Express Application)
                                              │
                                              ▼
                                      PostgreSQL / PGlite
```

---

## 7. Local Testing vs Vercel Serverless

- **Local Development**:
  ```bash
  npm start
  ```
  Runs the full standalone HTTP server with WebSockets (`Socket.IO`), live 1-minute simulation worker loop, and local UI.

- **Vercel Serverless**:
  Runs `api/index.js` as an auto-scaling serverless function. Database queries, authentication, state mutation, AI generation, and REST endpoints are fully supported on demand with global Edge CDN caching for static files.
