# Aetheria: Production Deployment Guide

## 1. Prerequisites
* **Node.js:** v20.x or v22.x+
* **Package Manager:** `pnpm` (recommended), `npm`, or `yarn`
* **Relational Database:** PostgreSQL v14+ (or zero-setup embedded persistent PGlite)
* **In-Memory Cache:** Redis v6+ (optional: in-memory store operates automatically)

---

## 2. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):

```bash
PORT=3000
NODE_ENV=production
APP_URL=https://your-domain.com

# Cryptographic Secrets
JWT_SECRET=generate_a_64_character_random_hex_string_here
SESSION_SECRET=generate_another_random_secret_here

# PostgreSQL Database
DATABASE_URL=postgresql://aetheria_user:secure_password@localhost:5432/aetheria_prod

# Redis Cache (Optional)
REDIS_URL=redis://localhost:6379

# Google OAuth 2.0 Credentials
# Obtain from Google Cloud Console -> APIs & Services -> Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Google Gemini AI Key (Optional: procedural fallback active if unset)
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 3. Database Migration & Universe Seeding

Run the schema migrations to instantiate all 59 relational tables:
```bash
node src/db/migrate.js
```

Seed the initial universe (Galaxy, Veridia Prime, Neo-Arcadia, academies, careers, AI NPCs, laws, and newspapers):
```bash
node src/db/seed.js
```

---

## 4. Running the Application

### Process Management with PM2
Install PM2 globally for high-availability cluster execution:
```bash
npm install -g pm2
pm2 start src/server.js --name "aetheria-simulator"
pm2 save
pm2 startup
```

---

## 5. Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name aetheria.universe;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name aetheria.universe;

    ssl_certificate /etc/letsencrypt/live/aetheria.universe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aetheria.universe/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Docker Deployment (Optional)

A lightweight `Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```
