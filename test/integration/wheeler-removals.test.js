// Wheeler-only UI removals: no Total Notional tile, no Expiring This Week table.
// Both are useful on HyperWheel (crypto) but noise on Wheeler, so they're gated
// to the crypto app only.
const { test } = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

function findCard(window, labelRegex) {
  for (const c of window.document.querySelectorAll('.ppnl-card')) {
    const lbl = c.querySelector('.ppnl-lbl');
    if (lbl && labelRegex.test(lbl.textContent)) return c;
  }
  return null;
}

test('Wheeler Premium tab drops the Total Notional tile; keeps Portfolio APR', async (t) => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 60, size: 100, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, closeDate: '', platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades });
  t.after(teardown);

  assert.strictEqual(findCard(window, /Total Notional/i), null,
    'Wheeler must not render the Total Notional tile');
  assert.ok(findCard(window, /Portfolio APR/i),
    'Portfolio APR tile should still render on Wheeler');
});

test('Wheeler does not populate the Expiring This Week table', async (t) => {
  // An option expiring within 7 days would normally fill the table on crypto.
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const expiry = soon.toISOString().slice(0, 10);
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-01-01', expiry,
      dte: 3, strike: 60, size: 100, premium: 120, outcome: 'OPEN',
      closeCost: 0, closeDate: '', platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades });
  t.after(teardown);

  const wrap = window.document.getElementById('expiry-table-wrap');
  assert.ok(wrap, 'expiry-table-wrap still exists in the shared shell');
  assert.doesNotMatch(wrap.innerHTML, /IBIT/,
    'Wheeler must not render expiring rows (section is CSS-hidden)');
});
