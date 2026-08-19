// ── LIVE PRICE FEED (tradfi / Wheeler) ────────────────────
// Equity/ETF spot for Wheeler holdings, mirroring HyperWheel's CoinGecko flow
// (fetchExpiryPrices) but for stocks/ETFs (#92). Finnhub is the primary
// real-time source; Twelve Data is the fallback and the sole source of the
// market-open indicator.
//
// Requests route through the /api/quote serverless proxy so the provider API
// keys stay server-side (Vercel env vars FINNHUB_KEY / TWELVEDATA_KEY) instead
// of shipping in the built HTML. Over file:// / a static server the proxy is
// unreachable, so both providers "fail" and the feed silently shows no spot —
// run `vercel dev` for live prices locally.

// Market-open state from Twelve Data's is_market_open: true | false | null(unknown).
// var (not let) so it lands on window for tests, like livePrices.
var sMarketOpen = null;

// Distinct tickers we hold or trade — the set to mark to spot.
function wheelerHeldTickers() {
  const seen = new Set();
  trades.forEach(t => { if (t.asset) seen.add(t.asset); });
  return [...seen];
}

// Finnhub /quote — one call per ticker, `c` is the current price. Any ticker
// failing rejects the batch so the caller fails over to Twelve Data wholesale.
async function finnhubPrices(tickers) {
  const out = {};
  await Promise.all(tickers.map(async t => {
    const r = await fetch('/api/quote?provider=finnhub&symbol=' + encodeURIComponent(t));
    if (!r.ok) throw new Error('finnhub ' + r.status);
    const d = await r.json();
    const p = d && d.c;
    if (typeof p !== 'number' || !p) throw new Error('finnhub no price for ' + t);
    out[t] = p;
  }));
  return out;
}

// Twelve Data /quote — one batched call. Returns { prices, isMarketOpen }.
// Single symbol → flat object; multiple → object keyed by symbol.
async function twelveDataQuote(tickers) {
  const r = await fetch('/api/quote?provider=twelvedata&symbols=' + tickers.map(encodeURIComponent).join(','));
  if (!r.ok) throw new Error('twelvedata ' + r.status);
  const d = await r.json();
  if (d && d.status === 'error') throw new Error(d.message || 'twelvedata error');
  const rows = tickers.length === 1 ? { [tickers[0]]: d } : d;
  const prices = {};
  let isMarketOpen = null;
  tickers.forEach(t => {
    const row = rows && rows[t];
    if (!row || row.status === 'error') return;
    const p = parseFloat(row.close);
    if (p) prices[t] = p;
    if (typeof row.is_market_open === 'boolean') isMarketOpen = row.is_market_open;
  });
  if (!Object.keys(prices).length) throw new Error('twelvedata no prices');
  return { prices, isMarketOpen };
}

// Fetch live spot for held tickers: Finnhub primary, Twelve Data fallback. The
// market-open indicator always comes from Twelve Data. A total outage leaves
// livePrices untouched (never blanks the holdings cards).
async function wheelerFetchPrices() {
  const tickers = wheelerHeldTickers();
  if (!tickers.length) return;

  let prices = null, marketOpen = sMarketOpen;
  try {
    prices = await finnhubPrices(tickers);
    // Finnhub carries no market state — ask Twelve Data just for the indicator.
    try { marketOpen = (await twelveDataQuote(tickers)).isMarketOpen; }
    catch (e) { /* keep last-known market state */ }
  } catch (ePrimary) {
    try {
      const td = await twelveDataQuote(tickers);
      prices = td.prices;
      marketOpen = td.isMarketOpen;
    } catch (eFallback) {
      return; // both providers down — do not blank existing prices
    }
  }

  livePrices = { ...livePrices, ...prices };
  sMarketOpen = marketOpen;
  wheelerUpdateStatus();

  const el = document.getElementById('expiry-last-refreshed');
  if (el) { const n = new Date(); el.textContent = 'refreshed ' + String(n.getUTCHours()).padStart(2, '0') + ':' + String(n.getUTCMinutes()).padStart(2, '0') + ' UTC'; }

  render();
}

// Paint the header market-open badge from sMarketOpen.
function wheelerUpdateStatus() {
  const el = document.getElementById('market-badge');
  if (!el) return;
  if (sMarketOpen === true)  { el.textContent = 'MARKET OPEN';   el.className = 'market-badge open'; }
  else if (sMarketOpen === false) { el.textContent = 'MARKET CLOSED'; el.className = 'market-badge closed'; }
  else { el.textContent = ''; el.className = 'market-badge'; }
}
