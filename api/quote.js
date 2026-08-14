/**
 * Server-side proxy for Wheeler live equity/ETF quotes (#92).
 * Keeps the provider API keys server-side (Vercel env vars FINNHUB_KEY /
 * TWELVEDATA_KEY) instead of shipping them in the built HTML. Transparent
 * passthrough — the client keeps the Finnhub-primary → Twelve-Data-fallback
 * failover, this just injects the key and dodges CORS.
 *
 * GET /api/quote?provider=finnhub&symbol=IBIT
 * GET /api/quote?provider=twelvedata&symbols=IBIT,MSTR
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { provider } = req.query;

  // ── FINNHUB (primary) — one symbol per call ─────────────────
  if (provider === 'finnhub') {
    const symbol = req.query.symbol || '';
    if (!/^[A-Za-z.\-]{1,12}$/.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    const key = process.env.FINNHUB_KEY;
    if (!key) return res.status(500).json({ error: 'FINNHUB_KEY not configured' });
    try {
      const upstream = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Finnhub upstream failed: ' + e.message });
    }
  }

  // ── TWELVE DATA (fallback + market-open state) — batched ─────
  if (provider === 'twelvedata') {
    const symbols = req.query.symbols || '';
    if (!/^[A-Za-z0-9.,\-]{1,120}$/.test(symbols)) {
      return res.status(400).json({ error: 'Invalid symbols' });
    }
    const key = process.env.TWELVEDATA_KEY;
    if (!key) return res.status(500).json({ error: 'TWELVEDATA_KEY not configured' });
    try {
      const upstream = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${key}`);
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Twelve Data upstream failed: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'provider must be finnhub or twelvedata' });
};
