# Aetheria: REST & Socket.IO API Documentation

All REST endpoints are rooted at `/api` and return standardized JSON payloads:
```json
{
  "success": true,
  "data": { ... }
}
```

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/google`
Verifies Google OAuth 2.0 credential and establishes an HTTP-only secure cookie session.
* **Body:** `{ "credential": "<google_jwt_id_token>" }`
* **Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "email": "pilot@gmail.com", "role": "player" },
  "hasCharacter": true,
  "redirect": "/dashboard.html"
}
```

### `POST /api/auth/demo-login`
Instant multi-account testing login without requiring Google Cloud secrets configured.
* **Body:** `{ "email": "citizen@aetheria.universe", "displayName": "Citizen Prime", "role": "player" }`

### `GET /api/auth/me`
Retrieves current authenticated citizen session and profile.

### `POST /api/auth/logout`
Clears session token and logs out the citizen.

---

## 2. Character & Player Management (`/api/player`)

### `GET /api/player/random-preview`
Generates starting circumstances for Random Life Mode (birthplace, family background, economic circumstances, suggested stats).

### `POST /api/player/create`
Creates a citizen profile in Custom Mode or Random Life Mode.
* **Body:**
```json
{
  "birthMode": "custom",
  "characterName": "Valen Cross",
  "username": "valen_cross",
  "gender": "Non-binary",
  "bio": "Pioneering researcher",
  "selectedCityId": 1,
  "avatarStyle": "bottts"
}
```

### `GET /api/player/profile/:idOrUsername`
Fetches complete public dossier (vital stats, skills, achievements, employment).

### `POST /api/player/progress-age`
Advances citizen virtual age and updates developmental life stage (Childhood, Youth, Adulthood, Senior).

---

## 3. Social Media & Comms (`/api/social` & `/api/chat`)

### `GET /api/social/feed?page=1&limit=20`
Paginated stream of planetary broadcasts with likes count and user reaction state.

### `POST /api/social/posts`
Publishes broadcast with hashtags and content. Emits `new_social_post` via Socket.IO.
* **Body:** `{ "content": "Expanding telemetry array in Solaris Basin! #Science" }`

### `POST /api/social/posts/:id/react`
Toggles like reaction on a post.

### `POST /api/social/posts/:id/comment`
Appends comment and pushes notification to author.

### `GET /api/chat/messages/:conversationId`
Retrieves paginated chat history for global, city, or direct message channels.

### `POST /api/chat/direct/:recipientProfileId`
Opens or retrieves direct messaging channel between two verified citizens.

---

## 4. Server-Authoritative Economy (`/api/economy` & `/api/marketplace`)

### `GET /api/economy/wallet`
Returns liquid balance and immutable ledger transactions.

### `POST /api/economy/transfer`
Atomic transfer of Credits between two citizens (with race-condition and negative balance prevention).
* **Body:**
```json
{
  "recipientUsername": "pilot_two",
  "amount": 75.00,
  "description": "Payment for components"
}
```

### `GET /api/marketplace/listings`
Returns active product listings.

### `POST /api/marketplace/buy/:id`
Purchases item with atomic debit/credit settlement and inventory decrement.

---

## 5. Education & Careers (`/api/education` & `/api/career`)

### `GET /api/education/institutions`
Lists accredited academies, tuition fees, and degree offerings.

### `POST /api/education/enroll`
Enrolls in academic program and deducts tuition.

### `POST /api/education/study`
Performs study session (+25 Skill XP to chosen discipline).

### `POST /api/career/apply`
Applies for job position (e.g. Lead Systems Architect, Clinical Bio-Physician).

### `POST /api/career/work`
Works a shift: collects net salary after national tax deduction into the country treasury.

---

## 6. Government & Politics (`/api/government`)

### `GET /api/government/current`
Returns Sovereign Council, cabinet, tax rate, treasury balance, and laws.

### `GET /api/government/elections`
Returns active elections, vote counts, and certified candidate platforms.

### `POST /api/government/vote`
Casts authenticated ballot. Enforces strict single-vote constraint per citizen per election.

### `POST /api/government/laws/propose`
Submits citizen bill for parliamentary consideration.

---

## 7. AI Services (`/api/npc` & `/api/assistant`)

### `POST /api/npc/:id/chat`
Converses with persistent AI citizen (Dr. Elena Rostova, Marcus Thorne, etc.).
* **Body:** `{ "message": "What is the status of the deep space signals?" }`
* **Response:**
```json
{
  "success": true,
  "npc": { "name": "Dr. Elena Rostova", "occupation": "Dean of Quantum Sciences" },
  "reply": "Greetings. Our arrays have isolated harmonic tachyon bursts from the outer rim.",
  "newMemory": "Discussed deep space signals with citizen."
}
```

### `POST /api/assistant/ask`
Queries ANI (Aetheria Navigation Intelligence) for contextual gameplay guidance.

---

## 8. Real-Time Socket.IO Events Reference

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_room` | Client -> Server | `{ "room": "planet_1" }` | Joins chat or lounge channel. |
| `send_message` | Client -> Server | `{ "conversationId": 1, "content": "..." }` | Emits chat transmission. |
| `new_message` | Server -> Client | Message object | Broadcasts message to room members. |
| `typing_start` / `stop` | Bidirectional | `{ "room": "...", "characterName": "..." }` | Real-time typing status. |
| `citizen_status` | Server -> Client | `{ "profileId": 1, "isOnline": true }` | Live citizen online beacon. |
| `world_tick` | Server -> Client | `{ "worldYear": 2185, "worldDay": 143 }` | Live planetary calendar progression. |
| `new_notification` | Server -> Client | Notification object | Instant toast alert for transfers, comments, etc. |
