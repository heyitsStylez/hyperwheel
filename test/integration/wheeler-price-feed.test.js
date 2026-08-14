// Wheeler (tradfi) live price-feed integration test (#92). Boots the second
// artifact in jsdom and drives wheelerFetchPrices() with a URL-routed fetch stub
// to assert: (1) held tickers are marked to spot on holdings cards, (2) a
// Finnhub (primary) failure falls back to Twelve Data without blanking prices,
// (3) the market-open indicator reflects Twelve Data's is_market_open, and
// (4) both-providers-down leaves existing prices intact.
const { test } = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Build a fetch stub that routes by URL substring. Each route is
// [substring, handler] where handler(url) -> Promise<{ok,status,json}>.
function routedFetch(routes) {
  return (url) => {
    for (const [needle, handler] of routes) {
      if (String(url).includes(needle)) return handler(url);
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  };
}
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status = 500) => Promise.resolve({ ok: false, status, json: async () => ({}) });

const holding = (over = {}) => ({
  id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
  strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL', ...over,
});

test('Finnhub primary: marks held ticker to spot on the holdings card', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [holding()] });
  t.after(teardown);

  window.fetch = routedFetch([
    ['provider=finnhub', () => ok({ c: 66 })],
    ['provider=twelvedata', () => ok({ symbol: 'IBIT', close: '66', is_market_open: true })],
  ]);

  await window.wheelerFetchPrices();

  assert.strictEqual(window.livePrices.IBIT, 66, 'Finnhub price should populate livePrices');
  // Net cost = 60, spot 66, 100 shares → +$600 unrealised on the holdings card.
  const holdings = window.document.getElementById('ncbwrap').innerHTML;
  assert.match(holdings, /\$66\b/, 'holdings card should show live spot');
  assert.match(holdings, /\+\$600\b/, 'holdings card should mark unrealised P&L vs net cost');
});

test('primary failure falls back to Twelve Data without blanking prices', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [holding()] });
  t.after(teardown);

  window.fetch = routedFetch([
    ['provider=finnhub', () => fail(500)],
    ['provider=twelvedata', () => ok({ symbol: 'IBIT', close: '62.5', is_market_open: false })],
  ]);

  await window.wheelerFetchPrices();

  assert.strictEqual(window.livePrices.IBIT, 62.5, 'fallback should populate price from Twelve Data');
  assert.match(window.document.getElementById('ncbwrap').innerHTML, /\$62.5\b/);
});

test('market-open indicator reflects Twelve Data is_market_open', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [holding()] });
  t.after(teardown);

  // Open
  window.fetch = routedFetch([
    ['provider=finnhub', () => fail(500)],
    ['provider=twelvedata', () => ok({ symbol: 'IBIT', close: '62', is_market_open: true })],
  ]);
  await window.wheelerFetchPrices();
  assert.strictEqual(window.sMarketOpen, true);
  assert.match(window.document.getElementById('footer-market').textContent, /OPEN/i);

  // Closed
  window.fetch = routedFetch([
    ['provider=finnhub', () => fail(500)],
    ['provider=twelvedata', () => ok({ symbol: 'IBIT', close: '62', is_market_open: false })],
  ]);
  await window.wheelerFetchPrices();
  assert.strictEqual(window.sMarketOpen, false);
  assert.match(window.document.getElementById('footer-market').textContent, /CLOSED/i);
});

test('both providers down leaves existing prices intact', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [holding()] });
  t.after(teardown);

  window.livePrices = { IBIT: 99 };
  window.fetch = routedFetch([
    ['provider=finnhub', () => fail(500)],
    ['provider=twelvedata', () => fail(500)],
  ]);

  await window.wheelerFetchPrices();

  assert.strictEqual(window.livePrices.IBIT, 99, 'a total provider outage must not blank prices');
});

test('multi-ticker Twelve Data fallback keyed by symbol', async (t) => {
  const seed = [
    holding({ id: 1, asset: 'IBIT', strike: 60, size: 100 }),
    holding({ id: 2, asset: 'MSTR', strike: 300, size: 10 }),
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);

  window.fetch = routedFetch([
    ['provider=finnhub', () => fail(500)],
    ['provider=twelvedata', () => ok({
      IBIT: { symbol: 'IBIT', close: '62', is_market_open: true },
      MSTR: { symbol: 'MSTR', close: '355', is_market_open: true },
    })],
  ]);

  await window.wheelerFetchPrices();

  assert.strictEqual(window.livePrices.IBIT, 62);
  assert.strictEqual(window.livePrices.MSTR, 355);
});
