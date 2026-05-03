const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Find the Realised P&L card by its label text.
function findRealisedCard(window) {
  const cards = window.document.querySelectorAll('.ppnl-card');
  for (const c of cards) {
    const lbl = c.querySelector('.ppnl-lbl');
    if (lbl && /Realised P&L/i.test(lbl.textContent)) return c;
  }
  return null;
}

test('Realised P&L tile renders settled premium total', (t) => {
  const trades = [
    // BTC PUT expired → +120
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
    // ETH PUT expired → +80
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 3000, size: 1, premium: 80, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // Default sFilter is 'ALL' — both assets contribute.
  const card = findRealisedCard(window);
  assert.ok(card, 'Realised P&L card should exist on Total tab');

  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$200/, `expected +$200, got "${main}"`);

  // Tooltip present.
  assert.match(card.getAttribute('title') || '', /Realised P&L/);
});

test('Realised P&L tile respects asset filter (sFilter)', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 3000, size: 1, premium: 80, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.setFilter('BTC');

  const card = findRealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$120/, `under BTC filter expected +$120, got "${main}"`);
});

test('CALL CALLED on HOLDING lot contributes capital gain to Realised tile', (t) => {
  // HOLDING ETH at 3000 size 1, then CALL at 3500 size 1 premium 50, called.
  // Realised = 50 + (3500-3000)*1 = 550
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      dte: 14, strike: 3500, size: 1, premium: 50, outcome: 'CALLED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // Default sFilter='ALL' — single-asset trade set sums to expected total.
  const card = findRealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$550/, `expected +$550, got "${main}"`);
});
