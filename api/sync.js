module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'Storage not configured' });

  const { code } = req.query;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!code || !uuidRe.test(code)) return res.status(400).json({ error: 'Invalid sync code' });

  const key = 'hw:' + code;

  async function upstash(command) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return r.json();
  }

  if (req.method === 'GET') {
    const result = await upstash(['GET', key]);
    if (result.result === null) return res.status(404).json({ error: 'No data found for this sync code' });
    try {
      return res.json(JSON.parse(result.result));
    } catch {
      return res.status(500).json({ error: 'Corrupt data in storage' });
    }
  }

  if (req.method === 'PUT') {
    const body = req.body;
    if (!body || !Array.isArray(body.trades)) return res.status(400).json({ error: 'Invalid payload' });
    const serialized = JSON.stringify(body);
    if (serialized.length > 1_000_000) return res.status(413).json({ error: 'Payload too large (max 1MB)' });
    await upstash(['SET', key, serialized]);
    return res.json({ ok: true, trades: body.trades.length });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
};
