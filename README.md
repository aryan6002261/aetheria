# 🌌 AETHERIA: Persistent AI-Powered Virtual Civilization Simulator

> *"Your real life is outside. Your second life is inside."*

Aetheria is a full-stack, multiplayer, AI-powered virtual life simulation platform that unites life simulation mechanics, social media, MMORPG systems, virtual economies, civilization progression, political democracy, and persistent AI NPCs across real-time persistent worlds.

---

## ⚡ Core Features

- **Living Universe Architecture:**
  - `Universe -> Galaxies -> Planets -> Countries -> Regions -> Cities -> Communities`
  - Launch world: **Veridia Prime** in the Andromeda-Sigma Sector.
  - Isolated planet systems with deep-space exploration and discovery mechanisms.
- **Character Creation Matrix:**
  - **Custom Mode:** Fine-tune appearance, suit chassis, eye glow, identity, and starting city.
  - **Random Life Mode:** Procedural generation of starting circumstances, family background, economic status, and initial traits with a limited reroll system.
- **Family & Household Lineage:**
  - Explicit consent-based child adoption, household mottos, and generational inheritance transfers.
- **Age & Life Progression:**
  - Life stages from Childhood to Elderhood with experience points, vital stats, and milestone tracking without penalizing offline players.
- **Education & Career Market:**
  - Attend higher academies (Imperial Polytechnic, Academy of Sciences, Arts Conservatory).
  - Careers spanning Engineering, Medicine, Governance, Commerce, Media, and Science with automated shift payroll and tax collection.
- **Server-Authoritative Double-Entry Economy:**
  - Currency: Credits (`₡`).
  - Zero client-side balance trust, atomic database transactions (`BEGIN ... COMMIT`), row-level locking, and immutable transaction ledger.
  - Incorporate corporations, manufacture virtual products, hire citizens, and trade on the Global Marketplace.
- **Civilization & Democratic Politics:**
  - Sovereign Cyber-Parliament with executive council, national budget, and citizen taxes.
  - Register political parties, draft proposed bills, and vote in general elections with verified single-ballot security.
- **Planetary Social Network & Real-Time Comms:**
  - Live broadcast feed with comments, reactions, and hashtags.
  - Multi-room Socket.IO chat (Global Holonet, City Channels, Private DMs, and Cyber Lounges).
- **Persistent AI Citizens (NPCs):**
  - Unique persistent identities (Dr. Elena Rostova, Marcus Thorne, Aria Solis, Kaelen Voss) with long-term memory continuity and autonomous daily schedules.
- **AI Tutorial Assistant (ANI):**
  - Context-aware Aetheria Navigation Intelligence guide.
- **The Veridian Chronicle:**
  - Planetary gazette generated strictly from actual database events and milestones.
- **Administrative Overseer Portal:**
  - Full system telemetry, user suspension controls, moderation reports, and immutable audit logs.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Bootstrap 5.3.3, Bootstrap Icons, Vanilla ES6 JavaScript, Socket.IO Client.
- **Backend:** Node.js (v22+), Express.js, Socket.IO.
- **Database:** PostgreSQL (with embedded persistent PGlite auto-fallback for zero-setup local execution).
- **Cache:** Redis / in-memory store.
- **AI Engine:** Google Gemini GenAI SDK (`@google/genai`) with procedural simulation engine.

---

## 🚀 Quick Start Guide

### 1. Installation
Clone the repository and install dependencies:
```bash
corepack pnpm install
# or
npm install
```

### 2. Configure Environment
Copy the environment template:
```bash
cp .env.example .env
```

### 3. Initialize Database & Seed Universe
Run the PostgreSQL migrations to create all 59 tables:
```bash
node src/db/migrate.js
```

Seed the initial galaxy, planet, nation, cities, academies, jobs, AI NPCs, and starter businesses:
```bash
node src/db/seed.js
```

### 4. Run Core Verification Tests
```bash
node tests/test-core.js
```

### 5. Launch the Platform
```bash
node src/server.js
```
Open your browser to: **[http://localhost:3000](http://localhost:3000)**

---

## 👥 Instant Multiplayer Testing
To test real-time multiplayer interactions between multiple citizens immediately:
1. Open **[http://localhost:3000/login.html](http://localhost:3000/login.html)** in Window 1 and click **"Enter as Citizen Alpha (Player 1)"**.
2. Open **[http://localhost:3000/login.html](http://localhost:3000/login.html)** in Window 2 (Incognito/Private) and click **"Enter as Citizen Beta (Player 2)"**.
3. Both citizens will be connected to Veridia Prime in real-time, can chat in the **Comms Terminal**, post broadcasts on the **Social Net**, transfer Credits via the **Ledger**, and interact with persistent AI NPCs!
4. Click **"Enter as Overseer Valen (Admin)"** to access the **Administrative Overseer Portal** at `/admin.html`.

---

## 📚 Documentation Directory
- **[Universe Architecture](docs/ARCHITECTURE.md)**
- **[REST & Socket.IO API Reference](docs/API_DOCUMENTATION.md)**
- **[Cybersecurity & Privacy Manual](docs/SECURITY.md)**
- **[Vercel Serverless Deployment Guide](docs/VERCEL_DEPLOYMENT.md)**
- **[Standard Production Deployment Guide](docs/DEPLOYMENT.md)**

---

## ☁️ Deploy to Vercel in 1 Click
Aetheria is pre-configured with `vercel.json` and a serverless API handler (`api/index.js`):
1. Push code to GitHub.
2. Import project into [Vercel](https://vercel.com).
3. (Optional) Add `DATABASE_URL` in Vercel Environment Variables to connect a managed PostgreSQL instance (e.g. Neon or Supabase). If omitted, the embedded persistent PGlite engine auto-initializes in `/tmp`.
4. Deploy! The database will auto-migrate and auto-seed on the very first incoming request.
See **[Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md)** for full details.

---

## 📜 License
MIT License. Created for the Aetheria Persistent Civilization Project.

