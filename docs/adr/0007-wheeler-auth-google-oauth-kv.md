# ADR 0007: Wheeler phase-2 identity — Google OAuth, KV-per-user, hand-rolled

- **Status:** Accepted
- **Date:** 2026-08-15
- **Related:** #105 (decision), #106 (epic), #84 (async persistence seam), #79/#83 (IBKR Flex)
- **Reserved-but-unwritten:** ADR 0006 (txHash retention on delete, #69)

## Context

Wheeler v1 shipped local-only: `tradfi/12a-persistence.js` stores trades under
`wheeler_trades` and `currentUserKey()` returns the constant `'local'` (#86,
#84). The persistence seam (`loadTrades`/`persist`/`currentUserKey`) was made
`Promise`-based from day one specifically so a server backend can slot in
without touching `core/`.

Phase 2 (#106) needs per-user server storage, and IBKR Flex auto-import
(#79/#83) can't happen without it — Flex tokens are per-user secrets that must
live server-side behind auth. So identity + storage is the one hard-gating
decision, and #105 requires it resolved as a single coupled cluster: auth model
→ datastore → per-user Flex-token storage.

## Decision

### 1. Auth model — Google OAuth (OpenID Connect)

Sign in with a Google account. Chosen over magic-link and heavier OAuth stacks:

- **vs magic-link:** Google verifies the email for us, so there is **no
  email-sending provider to run** (no Resend/SES). One-click familiar UX.
- **User identity:** `currentUserKey()` returns the Google **`sub`** claim (the
  stable, opaque account id), *not* the email — email can change, `sub` cannot.
- **Access control:** a server-side allow-list in the env var
  `WHEELER_ALLOWED_EMAILS` (comma-separated). Starts with the owner's email
  only; adding a user is an env-var edit + redeploy, no code change. The
  callback rejects any verified email not on the list.

### 2. Datastore — Upstash KV, keyed by authenticated `sub`

Reuse the existing Upstash KV that already backs `/api/sync` (see `api/sync.js`).
Trades are a per-user blob, not relational — no database is warranted.

- Wheeler trades: key `wheeler:<sub>` (mirrors crypto's `hw:<wallet>`).
- The tradfi persistence seam's server impl reads/writes this key; `core/`
  untouched, per #84.

### 3. Per-user Flex token storage — encrypted in KV

IBKR Flex tokens are per-user secrets. Store them **encrypted at rest** in the
same KV under a separate namespaced key `flex:<sub>`, encrypted with
`crypto.createCipheriv` (AES-256-GCM) using a server-only key from the env var
`WHEELER_ENC_KEY`. `api/ibkr-flex.js` decrypts per authenticated request to call
the IBKR Activity Flex endpoint (#79: Vercel serverless proxy, T+1 EOD
accepted). This is the one genuinely new security surface.

### 4. Implementation — hand-rolled with Node `crypto`, no npm

No auth library (no NextAuth/Auth.js, no `jose`). The client bundle stays
single-file/zero-dep regardless; the serverless `api/` functions also stay
dependency-free, consistent with the existing `sync.js`/`chain-sync.js` style.
Node's built-in `crypto` + `fetch` cover everything:

- **Login start:** client redirects to Google's authorization endpoint with
  `client_id`, `redirect_uri`, `scope=openid email`, and a random `state`.
- **Callback** (`api/auth/google.js` or similar): exchanges the `code` for
  tokens using `GOOGLE_CLIENT_SECRET` server-side, verifies Google's `id_token`
  (signature against Google's JWKS, `aud`/`iss`/`exp`), extracts `sub` + `email`,
  checks the allow-list, then issues **our own** session JWT (HS256, signed with
  `WHEELER_SESSION_SECRET`) set as an HttpOnly, Secure, SameSite cookie.
- **Session check:** `/api/sync` (Wheeler) and `api/ibkr-flex.js` verify the
  session cookie to resolve `sub` on every request.

New env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WHEELER_ALLOWED_EMAILS`,
`WHEELER_SESSION_SECRET`, `WHEELER_ENC_KEY`.

## Consequences

- Requires a Google Cloud OAuth client + consent-screen config (one-time
  dashboard setup). For a handful of users it stays on Google's "unverified app"
  screen — they click through once; acceptable for a shared-with-a-few tool.
- Hand-rolling means we own the `id_token` verification (JWKS fetch + cache) and
  session-cookie signing/verification. Small, well-bounded code — a callback
  function plus a `verifySession` helper — but it is security-sensitive and must
  be reviewed carefully.
- KV-per-user keyed by `sub` fits the async seam with no `core/` refactor; the
  crypto app and Wheeler share the KV instance under distinct key prefixes.
- Unlocks the phase-2 build tickets (auth + per-user persistence impl,
  `api/ibkr-flex.js`) whose shape was gated on this decision.

## Alternatives considered

- **Magic-link** — rejected: needs an email-sending provider to run and offers
  worse UX for this audience.
- **Serverless-only auth library (`jose` / Auth.js core)** — rejected: would
  introduce the first runtime dependency the repo has avoided; the hand-rolled
  path is small enough not to justify it.
- **Relational DB** — rejected: trades are a per-user blob; KV already works.
