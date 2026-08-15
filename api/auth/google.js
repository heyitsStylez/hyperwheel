// Google OAuth (OIDC) route for Wheeler (#110, ADR 0007). Hand-rolled, no npm.
//   GET /api/auth/google                 → redirect to Google's consent screen
//   GET /api/auth/google?code=..&state=. → callback: verify, set session cookie
//   GET /api/auth/google?action=logout   → clear session cookie
const crypto = require('crypto');
const auth = require('../_auth');

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

function origin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + req.headers.host;
}
function redirectUri(req) { return origin(req) + '/api/auth/google'; }

function cookie(name, value, maxAge) {
  const bits = [
    name + '=' + encodeURIComponent(value),
    'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=' + maxAge,
  ];
  return bits.join('; ');
}

module.exports = async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.WHEELER_SESSION_SECRET;
  const allowlist = process.env.WHEELER_ALLOWED_EMAILS;
  if (!clientId || !clientSecret || !sessionSecret) {
    return res.status(503).send('auth not configured');
  }

  const { code, state, action, error } = req.query;

  // Logout — clear the session cookie and return to the app.
  if (action === 'logout') {
    res.setHeader('Set-Cookie', cookie(auth.SESSION_COOKIE, '', 0));
    res.statusCode = 302;
    res.setHeader('Location', '/wheeler');
    return res.end();
  }

  // Callback leg — Google redirected back with a code (or an error).
  if (code || error) {
    if (error) return res.status(400).send('Sign-in cancelled.');
    const stateCookie = auth.parseCookie(req.headers.cookie, auth.STATE_COOKIE);
    if (!state || !stateCookie || state !== stateCookie) {
      return res.status(400).send('Invalid OAuth state.');
    }
    try {
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri(req), grant_type: 'authorization_code',
        }).toString(),
      });
      const tokens = await tokenRes.json();
      if (!tokens.id_token) return res.status(401).send('Token exchange failed.');

      const jwks = await auth.fetchGoogleJwks();
      const claims = auth.verifyIdTokenWithJwks(tokens.id_token, clientId, jwks);
      if (!claims) return res.status(401).send('Could not verify Google identity.');
      if (!auth.emailAllowed(claims.email, allowlist)) {
        return res.status(403).send('This account is not authorised for Wheeler.');
      }

      const session = auth.signSession(
        { sub: claims.sub, email: claims.email }, sessionSecret, SESSION_TTL);
      res.setHeader('Set-Cookie', [
        cookie(auth.SESSION_COOKIE, session, SESSION_TTL),
        cookie(auth.STATE_COOKIE, '', 0),
      ]);
      res.statusCode = 302;
      res.setHeader('Location', '/wheeler');
      return res.end();
    } catch {
      return res.status(502).send('Sign-in failed. Please try again.');
    }
  }

  // Login leg — mint a state nonce and bounce to Google.
  const nonce = crypto.randomBytes(16).toString('hex');
  const url = AUTH_ENDPOINT + '?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email',
    state: nonce,
    prompt: 'select_account',
  }).toString();
  res.setHeader('Set-Cookie', cookie(auth.STATE_COOKIE, nonce, 600));
  res.statusCode = 302;
  res.setHeader('Location', url);
  return res.end();
};
