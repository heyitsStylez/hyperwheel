module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(503).json({ error: 'sync not configured' });

  const wallet = (req.query.wallet || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'invalid wallet' });
  }

  const key = 'hw:' + wallet;

  async function kv(command) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return r.json();
  }

  if (req.method === 'GET') {
    const result = await kv(['GET', key]);
    if (!result.result) return res.json({ holdings: [], savedAt: 0 });
    try {
      return res.json(JSON.parse(result.result));
    } catch {
      return res.json({ holdings: [], savedAt: 0 });
    }
  }

  if (req.method === 'POST') {
    const { holdings, savedAt } = req.body || {};
    if (!Array.isArray(holdings)) return res.status(400).json({ error: 'invalid body' });
    const value = JSON.stringify({ holdings, savedAt: savedAt || Date.now() });
    if (value.length > 500_000) return res.status(413).json({ error: 'payload too large' });
    await kv(['SET', key, value]);
    return res.json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
};
