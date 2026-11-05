# Aetheria: Cybersecurity & Privacy Architecture

## 1. Authentication Security
* **Google OAuth 2.0:** Integrates Google's official token verification protocol (`google-auth-library`). User passwords are **never** received, processed, or stored.
* **HTTP-Only, Secure Cookies:** Session JWT tokens are delivered in `SameSite: Lax`, `HttpOnly` cookies to eliminate XSS token theft.
* **Session Verification:** Backend middleware validates database active status and role permissions on every protected request.

---

## 2. Server-Authoritative Economic Ledger
Aetheria operates under a zero-trust model regarding client-side balances:
* **No Client Trust:** Client applications cannot submit balance changes directly.
* **ACID Transactions:** All currency transfers, marketplace orders, and payroll disbursements run inside database transactions (`BEGIN` ... `COMMIT` / `ROLLBACK`).
* **Row-Level Locking:** Sender wallets are locked with `FOR UPDATE` to prevent concurrent race conditions, duplicate spend exploits, and overdrafts.
* **Check Constraints:** PostgreSQL database schema enforces `CHECK (balance >= 0.00)` at the engine level, making negative balances mathematically impossible.

---

## 3. Defense Against Common Vulnerabilities

### Cross-Site Scripting (XSS)
* Strict output sanitization across all chat channels, broadcasts, and comments (`escapeHtml`).
* Content Security Policy (CSP) enforced via `helmet` restricting script execution to approved domains and disallowing unauthorized external sources.

### SQL Injection Prevention
* 100% of database queries utilize parameterized `$1, $2, ...` placeholders. Raw string interpolation into SQL queries is prohibited across the entire codebase.

### Rate Limiting & Denial of Service
* Express rate limiters applied at multiple tiers:
  * General API: 300 requests / 15 minutes
  * Authentication: 30 requests / 15 minutes
  * Chat & Social Broadcasts: 60 actions / minute

### File Upload Security
* Multer upload middleware enforces:
  * Strict MIME type whitelisting (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`).
  * Maximum file size limit (5MB).
  * Storage with randomized UUID file names to eliminate directory traversal attacks (`../../`).

---

## 4. Privacy & Moderation Controls
* **Private Account Settings:** Citizens can customize visibility and report abusive content.
* **Single-Vote Election Integrity:** The `votes` table enforces a database-level unique constraint (`UNIQUE(election_id, voter_profile_id)`) ensuring no duplicate voting is possible.
* **Immutable Audit Logs:** All sensitive operations (logins, bans, transactions, votes) are written to the `audit_logs` table with IP addresses and metadata.
* **Admin Moderation:** Administrative dashboard allows instant suspension or restoration of compromised accounts and review of citizen reports.

