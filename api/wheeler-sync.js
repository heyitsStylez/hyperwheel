// Per-user Wheeler trade sync (#110, ADR 0007). Session-cookie authed, keyed by
// the Google `sub` from the verified session. Stores the FULL trade array
// (unlike crypto's HOLDING-only /api/sync). Reuses the same Upstash KV.
const auth = require('./_auth');

module.exports = async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const sessionSecret = process.env.WHEELER_SESSION_SECRET;
  if (!url || !token || !sessionSecret) {
    return res.status(503).json({ error: 'sync not configured' });
  }

  const session = auth.sessionFromReq(req, sessionSecret);

  async function kv(command) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return r.json();
  }

  if (req.method === 'GET') {
    // Unauthenticated is not an error — the client uses it to detect state.
    if (!session) return res.json({ authed: false });
    const result = await kv(['GET', 'wheeler:' + session.sub]);
    let stored = { trades: [], savedAt: 0 };
    if (result.result) { try { stored = JSON.parse(result.result); } catch { /* keep default */ } }
    return res.json({ authed: true, email: session.email, ...stored });
  }

  if (req.method === 'POST') {
    if (!session) return res.status(401).json({ error: 'not signed in' });
    const { trades, savedAt } = req.body || {};
    if (!Array.isArray(trades)) return res.status(400).json({ error: 'invalid body' });
    const value = JSON.stringify({ trades, savedAt: savedAt || Date.now() });
    if (value.length > 1_000_000) return res.status(413).json({ error: 'payload too large' });
    await kv(['SET', 'wheeler:' + session.sub, value]);
    return res.json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
};
