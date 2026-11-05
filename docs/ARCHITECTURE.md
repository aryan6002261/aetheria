# Aetheria: Universe & System Architecture

## 1. Overview & Project Philosophy
> *"Your real life is outside. Your second life is inside."*

Aetheria is a full-stack, persistent, multiplayer, AI-powered virtual civilization and social life simulator. It bridges the gap between deep life simulation mechanics, real-time social networking, server-authoritative economies, and democratic governance.

---

## 2. Universe Hierarchy
Aetheria implements an extensible astronomical-to-civic hierarchy:

```
UNIVERSE
  └── GALAXIES (e.g. Andromeda-Sigma Sector [042, 118, 903])
        └── PLANETS / WORLD SERVERS (e.g. Veridia Prime)
              └── COUNTRIES (e.g. Neo-Arcadia [ARC])
                    └── REGIONS (e.g. Solaris Basin)
                          └── CITIES (e.g. Aethel City, Nova Haven)
                                └── COMMUNITIES (e.g. Nexus Spire District)
```

### Planet Isolation & Discovery Mechanism
* Every planet maintains its own independent timeline, day cycle (24h default), population, currency (`Credits ₡`), legal statutes, and market listings.
* Initially launched with **one fully functional world (Veridia Prime)**.
* Additional planets remain undiscovered until triggered by administrative expansion or player space exploration expeditions (`POST /api/world/discover`).
* Discovery establishes inter-planetary communication, trade treaties, and diplomatic exchanges.

---

## 3. Technology Stack

### Frontend
* **Core Markup & Styling:** HTML5, CSS3, Bootstrap 5.3.3, Bootstrap Icons 1.11.3
* **Scripting:** Pure Vanilla JavaScript (Modular ES6 modules, Fetch API for asynchronous REST operations)
* **Real-Time Client:** Socket.IO Client for instant messaging, live notification toasts, and planetary clock ticks
* **Design Philosophy:** Cyberpunk / futuristic dark interface with glassmorphism (`backdrop-filter: blur(14px)`), neon cyan/violet accents, and live telemetry badges.

### Backend
* **Runtime:** Node.js (v22+) & Express.js
* **Real-Time Engine:** Socket.IO Server with room partitioning (`planet_*`, `city_*`, `lounge_*`, `conv_*`, `user_*`)
* **Primary Relational Database:** PostgreSQL (Normalized 59-table schema with transactional integrity)
  * Seamless auto-fallback to embedded persistent PGlite when external PostgreSQL instances are not configured.
* **Cache & Memory Store:** Redis (`ioredis`) with transparent high-speed in-memory Map fallback.
* **AI Modular Integration Layer:** Google GenAI SDK (`@google/genai`) for Gemini models, backed by an autonomous procedural generation fallback engine.
* **Background World Worker:** Scheduled tick worker (`src/workers/simulationWorker.js`) driving the planetary calendar, NPC schedules, and newspaper publishing.

---

## 4. Master Relational Schema (59 Tables)

| Category | Database Tables | Description |
| :--- | :--- | :--- |
| **Auth & Security** | `users`, `user_auth_providers`, `sessions`, `audit_logs`, `moderation_actions`, `reports` | Secure Google OAuth 2.0, HTTP-only cookie sessions, audit trails, and moderation. |
| **Universe Topology** | `galaxies`, `planets`, `countries`, `regions`, `cities`, `communities`, `discoveries` | Geographical and interstellar coordinates, populations, and discovery states. |
| **Citizens & Avatars** | `avatars`, `player_profiles`, `character_stats`, `skills`, `player_skills` | Visual chassis, vital metrics (health, energy, intellect), skills, and life stages. |
| **Family & Households** | `families`, `family_members`, `relationships` | Consent-based child adoption, lineages, and generational wealth transfers. |
| **Education & Career** | `education_institutions`, `enrollments`, `jobs`, `employment` | Accredited degree programs, skill XP exams, career contracts, and daily shift payroll. |
| **Economy & Commerce** | `wallets`, `transactions`, `bank_accounts`, `businesses`, `business_employees`, `products`, `marketplace_listings` | Server-authoritative double-entry ledger, corporate incorporation, and open trading. |
| **Government & Politics** | `governments`, `political_parties`, `elections`, `votes`, `laws` | Parliamentary cabinets, registered parties, single-vote election security, and statutory acts. |
| **Social & Messaging** | `social_posts`, `post_media`, `comments`, `reactions`, `friendships`, `follows`, `conversations`, `conversation_members`, `messages`, `lounges`, `lounge_members`, `community_members`, `notifications` | Public/private comms, broadcasts, reactions, and live cyber-lounge hangouts. |
| **Missions & Progress** | `missions`, `player_missions`, `achievements`, `player_achievements` | Category-based civic directives, anti-abuse validation, XP, and badges. |
| **AI Citizens & Lore** | `npc_characters`, `npc_memories`, `npc_relationships`, `world_events`, `historical_records` | Persistent NPC personalities, schedules, long-term memory, and grounded gazette archives. |

---

## 5. Background World Simulation Cycle
The simulation engine executes periodic background ticks:
1. **Calendar Clock:** Advances planetary days and years (broadcasted in real-time to active user HUDs).
2. **Autonomous NPC Behaviors:** NPCs simulate daily routines and post commentary to the planetary social feed.
3. **The Veridian Chronicle:** Synthesizes recent database transactions, elections, and milestones into coherent journalistic dispatches.
