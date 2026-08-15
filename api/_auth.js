// Hand-rolled auth helpers for Wheeler (#110, ADR 0007). No npm — Node crypto only.
//   - Our own session token: HS256 JWT signed with WHEELER_SESSION_SECRET.
//   - Google id_token: RS256 verified against Google's JWKS.
// Underscore-prefixed so Vercel treats this as a shared module, not a route.
// Pure functions are dual-exported for Node tests (see test/unit/auth.test.js).
const crypto = require('crypto');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS = ['https://accounts.google.com', 'accounts.google.com'];
const SESSION_COOKIE = 'wheeler_session';
const STATE_COOKIE = 'wheeler_oauth_state';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) { return b64url(JSON.stringify(obj)); }
function b64urlDecode(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ── Our own session JWT (HS256) ──────────────────────────────
function signSession(payload, secret, ttlSec = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const signing = b64urlJson({ alg: 'HS256', typ: 'JWT' }) + '.' + b64urlJson(body);
  const sig = b64url(crypto.createHmac('sha256', secret).update(signing).digest());
  return signing + '.' + sig;
}

function verifySession(token, secret, now = Math.floor(Date.now() / 1000)) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = b64url(crypto.createHmac('sha256', secret).update(h + '.' + p).digest());
  const a = Buffer.from(s), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(p).toString('utf8')); } catch { return null; }
  if (typeof payload.exp === 'number' && now >= payload.exp) return null;
  return payload;
}

function parseCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function sessionFromReq(req, secret) {
  const token = parseCookie(req.headers && req.headers.cookie, SESSION_COOKIE);
  return verifySession(token, secret);
}

function emailAllowed(email, csv) {
  if (!email || !csv) return false;
  const allow = csv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(String(email).toLowerCase());
}

// ── Google id_token (RS256) verification ─────────────────────
// Pure given the JWKS key set, so tests can sign a token with a local keypair.
function verifyIdTokenWithJwks(idToken, clientId, jwksKeys, now = Math.floor(Date.now() / 1000)) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(h).toString('utf8'));
    payload = JSON.parse(b64urlDecode(p).toString('utf8'));
  } catch { return null; }
  const jwk = (jwksKeys || []).find(k => k.kid === header.kid);
  if (!jwk) return null;
  let pub;
  try { pub = crypto.createPublicKey({ key: jwk, format: 'jwk' }); } catch { return null; }
  if (!crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), pub, b64urlDecode(s))) return null;
  if (!GOOGLE_ISS.includes(payload.iss)) return null;
  if (payload.aud !== clientId) return null;
  if (typeof payload.exp === 'number' && now >= payload.exp) return null;
  if (payload.email_verified === false) return null;
  return payload; // { sub, email, ... }
}

async function fetchGoogleJwks(fetchImpl = fetch) {
  const r = await fetchImpl(GOOGLE_JWKS_URL);
  const data = await r.json();
  return data.keys || [];
}

module.exports = {
  b64url, b64urlDecode, signSession, verifySession, parseCookie,
  sessionFromReq, emailAllowed, verifyIdTokenWithJwks, fetchGoogleJwks,
  SESSION_COOKIE, STATE_COOKIE, GOOGLE_JWKS_URL, GOOGLE_ISS,
};
