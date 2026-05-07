const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Issue #52: Wide-card layout for holding cards at low lot counts.
// JS-side contract: when the number of *visible* open lots is <= 2, the
// .holdings-grid element gains the class `holdings-grid--wide`. The CSS
// activates the wide row layout at >= 720px viewport width via @media.

const ethHolding = {
  id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
  dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
  closeCost: 0, platform: 'SPOT',
};

function btcHolding(id, n) {
  return { id, asset: 'BTC', type: 'HOLDING', date: '2026-0' + n + '-01',
    expiry: '', dte: null, strike: 60000 + id, size: 0.1, premium: 0,
    outcome: 'OPEN', closeCost: 0, platform: 'SPOT' };
}

function getGrid(window) {
  const g = window.document.querySelector('.holdings-grid');
  assert.ok(g, 'expected a .holdings-grid element');
  return g;
}

test('1 visible open lot: holdings-grid has --wide class', (t) => {
  const { window, teardown } = setupJsdom({ trades: [ethHolding] });
  t.after(teardown);
  const grid = getGrid(window);
  assert.ok(grid.classList.contains('holdings-grid--wide'),
    'grid should have holdings-grid--wide class with 1 visible lot');
});

test('2 visible open lots: holdings-grid has --wide class', (t) => {
  const { window, teardown } = setupJsdom({
    trades: [ethHolding, btcHolding(2, 2)],
  });
  t.after(teardown);
  const grid = getGrid(window);
  assert.ok(grid.classList.contains('holdings-grid--wide'),
    'grid should have holdings-grid--wide class with 2 visible lots');
});

test('3 visible open lots: holdings-grid does NOT have --wide class', (t) => {
  const { window, teardown } = setupJsdom({
    trades: [ethHolding, btcHolding(2, 2), btcHolding(3, 3)],
  });
  t.after(teardown);
  const grid = getGrid(window);
  assert.ok(!grid.classList.contains('holdings-grid--wide'),
    'grid should NOT have holdings-grid--wide class with 3+ visible lots');
});

test('asset filter honored: BTC filter w/ 1 BTC lot among many → wide', (t) => {
  const { window, teardown } = setupJsdom({
    trades: [ethHolding, btcHolding(2, 2), btcHolding(3, 3),
             { ...ethHolding, id: 4, date: '2026-02-01' }],
  });
  t.after(teardown);
  // Filter to BTC: should reduce visible lots to 2 → wide class applies.
  window.setFilter('BTC');
  const grid = getGrid(window);
  assert.ok(grid.classList.contains('holdings-grid--wide'),
    'asset filter should narrow visible-lot count for the threshold');
});

test('missing spot: card renders stable Spot — placeholder', (t) => {
  // No livePrices stub → spot is undefined.
  const { window, teardown } = setupJsdom({ trades: [ethHolding] });
  t.after(teardown);
  const card = window.document.querySelector('.hcard');
  const spot = card.querySelector('.hcard-spot');
  assert.ok(spot, 'spot block should render even when price missing');
  assert.match(spot.textContent, /Spot\s*—/,
    'placeholder should show "Spot —"');
  assert.match(spot.textContent, /spot unavailable/i,
    'placeholder sub-line should read "spot unavailable"');
});

test('wide layout preserves edit btn, lot badge, merge btn', (t) => {
  // 2 ETH lots: edit btn (HOLDING), lot badge (>1 lot), merge btn (>=2 open).
  const { window, teardown } = setupJsdom({
    trades: [
      ethHolding,
      { ...ethHolding, id: 2, date: '2026-02-01', strike: 3200 },
    ],
  });
  t.after(teardown);
  const grid = getGrid(window);
  assert.ok(grid.classList.contains('holdings-grid--wide'),
    'precondition: 2 lots → wide');
  const cards = window.document.querySelectorAll('.hcard');
  assert.strictEqual(cards.length, 2);
  assert.ok(cards[0].querySelector('.hcard-edit'), 'edit button present');
  assert.ok(cards[0].querySelector('.lot-badge'), 'lot badge present');
  assert.ok(window.document.querySelector('.btn-merge'),
    'merge button present');
});
