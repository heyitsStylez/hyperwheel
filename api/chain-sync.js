/**
 * Server-side proxy for chain sync sources.
 * Avoids CORS issues when fetching from Rysk and Hypersurface APIs.
 *
 * GET  /api/chain-sync?source=rysk&type=history&address=0x...
 * GET  /api/chain-sync?source=rysk&type=positions&address=0x...
 * POST /api/chain-sync?source=hypersurface  (body = GraphQL JSON)
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { source, type, address } = req.query;

  // ── RYSK ────────────────────────────────────────────────────
  if (source === 'rysk') {
    if (!address) return res.status(400).json({ error: 'address required' });
    if (!['history', 'positions'].includes(type)) return res.status(400).json({ error: 'type must be history or positions' });

    const endpoint = type === 'history'
      ? `https://v12.rysk.finance/api/history?address=${address}`
      : `https://v12.rysk.finance/api/user/positions?address=${address}`;

    try {
      const upstream = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Rysk upstream failed: ' + e.message });
    }
  }

  // ── HYPERSURFACE (Goldsky GraphQL) ──────────────────────────
  if (source === 'hypersurface') {
    if (req.method !== 'POST') return res.status(405).end();
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    // Only allow Goldsky URLs to prevent SSRF
    if (!url.startsWith('https://api.goldsky.com/')) {
      return res.status(400).json({ error: 'Only Goldsky URLs are allowed' });
    }

    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Hypersurface upstream failed: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'source must be rysk or hypersurface' });
};
