// Unit tests for the hand-rolled Wheeler auth helpers (#110). Pure crypto only —
// no network. The Google id_token path is exercised with a locally-generated RSA
// keypair whose public JWK we feed in as the "JWKS".
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const auth = require('../../api/_auth');

const SECRET = 'test-session-secret';

test('signSession/verifySession round-trips and carries claims', () => {
  const token = auth.signSession({ sub: '123', email: 'a@b.com' }, SECRET);
  const p = auth.verifySession(token, SECRET);
  assert.strictEqual(p.sub, '123');
  assert.strictEqual(p.email, 'a@b.com');
  assert.ok(p.exp > p.iat);
});

test('verifySession rejects a tampered payload', () => {
  const token = auth.signSession({ sub: '123', email: 'a@b.com' }, SECRET);
  const [h, , s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'evil', exp: 9e9 }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.strictEqual(auth.verifySession(h + '.' + forged + '.' + s, SECRET), null);
});

test('verifySession rejects the wrong secret and expired tokens', () => {
  const token = auth.signSession({ sub: '123' }, SECRET);
  assert.strictEqual(auth.verifySession(token, 'other'), null);
  const expired = auth.signSession({ sub: '123' }, SECRET, -10);
  assert.strictEqual(auth.verifySession(expired, SECRET), null);
});

test('parseCookie extracts a named cookie from the header', () => {
  const h = 'foo=1; wheeler_session=abc.def.ghi; bar=2';
  assert.strictEqual(auth.parseCookie(h, 'wheeler_session'), 'abc.def.ghi');
  assert.strictEqual(auth.parseCookie(h, 'missing'), null);
  assert.strictEqual(auth.parseCookie(undefined, 'x'), null);
});

test('sessionFromReq reads and verifies the session cookie', () => {
  const token = auth.signSession({ sub: 'z' }, SECRET);
  const req = { headers: { cookie: 'wheeler_session=' + token } };
  assert.strictEqual(auth.sessionFromReq(req, SECRET).sub, 'z');
  assert.strictEqual(auth.sessionFromReq({ headers: {} }, SECRET), null);
});

test('emailAllowed matches the allow-list case-insensitively', () => {
  const csv = 'Owner@Gmail.com, friend@x.io';
  assert.ok(auth.emailAllowed('owner@gmail.com', csv));
  assert.ok(auth.emailAllowed('FRIEND@X.IO', csv));
  assert.ok(!auth.emailAllowed('stranger@x.io', csv));
  assert.ok(!auth.emailAllowed('owner@gmail.com', ''));
  assert.ok(!auth.emailAllowed('', csv));
});

// ── Google id_token verification ──
function makeIdToken(privateKey, kid, claims) {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signing = b64(header) + '.' + b64(claims);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signing), privateKey)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return signing + '.' + sig;
}

function keypairAndJwk(kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = kid; jwk.alg = 'RS256'; jwk.use = 'sig';
  return { privateKey, jwk };
}

test('verifyIdTokenWithJwks accepts a valid, allow-listed token', () => {
  const { privateKey, jwk } = keypairAndJwk('k1');
  const exp = Math.floor(Date.now() / 1000) + 600;
  const token = makeIdToken(privateKey, 'k1', {
    iss: 'https://accounts.google.com', aud: 'client-123',
    sub: 'user-1', email: 'owner@gmail.com', email_verified: true, exp,
  });
  const claims = auth.verifyIdTokenWithJwks(token, 'client-123', [jwk]);
  assert.strictEqual(claims.sub, 'user-1');
  assert.strictEqual(claims.email, 'owner@gmail.com');
});

test('verifyIdTokenWithJwks rejects wrong aud, bad iss, expiry, and bad signature', () => {
  const { privateKey, jwk } = keypairAndJwk('k1');
  const base = { iss: 'https://accounts.google.com', sub: 'u', email: 'o@g.com', email_verified: true };
  const good = Math.floor(Date.now() / 1000) + 600;
  const past = Math.floor(Date.now() / 1000) - 600;

  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(privateKey, 'k1', { ...base, aud: 'other', exp: good }), 'client-123', [jwk]), null);
  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(privateKey, 'k1', { ...base, iss: 'evil.com', aud: 'client-123', exp: good }), 'client-123', [jwk]), null);
  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(privateKey, 'k1', { ...base, aud: 'client-123', exp: past }), 'client-123', [jwk]), null);

  // Signed by a different key than the JWKS advertises → signature fails.
  const other = keypairAndJwk('k1');
  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(other.privateKey, 'k1', { ...base, aud: 'client-123', exp: good }), 'client-123', [jwk]), null);
});

test('verifyIdTokenWithJwks rejects unknown kid and unverified email', () => {
  const { privateKey, jwk } = keypairAndJwk('k1');
  const exp = Math.floor(Date.now() / 1000) + 600;
  const common = { iss: 'https://accounts.google.com', aud: 'client-123', sub: 'u', email: 'o@g.com' };
  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(privateKey, 'nope', { ...common, email_verified: true, exp }), 'client-123', [jwk]), null);
  assert.strictEqual(auth.verifyIdTokenWithJwks(
    makeIdToken(privateKey, 'k1', { ...common, email_verified: false, exp }), 'client-123', [jwk]), null);
});
