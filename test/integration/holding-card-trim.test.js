const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Issue #51: Trim redundant content from holding cards.
// - Hero sub-line ("basis $X — saved $Y") removed.
// - Premium-reduction bar removed.
// - Footer stats: Cost Basis | CC Premiums | Premium Reduction % (3 cols, in order).

function getHcard(window) {
  const card = window.document.querySelector('.hcard');
  assert.ok(card, 'expected a .hcard element on the page');
  return card;
}

const baseTrades = [
  { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
    dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
    closeCost: 0, platform: 'SPOT' },
  { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
    dte: 14, strike: 3500, size: 1, premium: 60, outcome: 'EXPIRED',
    closeCost: 0, platform: 'RYSK' },
];

test('holding card has no hero sub-line', (t) => {
  const { window, teardown } = setupJsdom({ trades: baseTrades });
  t.after(teardown);
  const card = getHcard(window);
  assert.strictEqual(card.querySelector('.hcard-hero-sub'), null,
    '.hcard-hero-sub should be removed');
});

test('holding card has no premium-reduction bar', (t) => {
  const { window, teardown } = setupJsdom({ trades: baseTrades });
  t.after(teardown);
  const card = getHcard(window);
  assert.strictEqual(card.querySelector('.hcard-bar-wrap'), null,
    '.hcard-bar-wrap should be removed');
});

test('holding card footer has 3 stats: Cost Basis | CC Premiums | Premium Reduction %', (t) => {
  const { window, teardown } = setupJsdom({ trades: baseTrades });
  t.after(teardown);
  const card = getHcard(window);

  const stats = card.querySelectorAll('.hcard-stats .hcard-stat');
  assert.strictEqual(stats.length, 3, 'footer should have exactly 3 stat cells');

  const labels = Array.from(stats).map(s =>
    s.querySelector('.hcard-stat-lbl').textContent.trim());
  assert.deepStrictEqual(labels, ['Cost Basis', 'CC Premiums', 'Premium Reduction %'],
    'stat labels must appear in this order');

  // Net cost = 3000 - 60 = 2940; reduction = 60/3000 = 2.0%.
  const values = Array.from(stats).map(s =>
    s.querySelector('.hcard-stat-val').textContent.trim());
  assert.match(values[0], /\$3,?000(\.\d+)?$/, `Cost Basis value, got "${values[0]}"`);
  assert.match(values[1], /\$60(\.\d+)?$/, `CC Premiums value, got "${values[1]}"`);
  assert.match(values[2], /^2\.0%$/, `Reduction % value, got "${values[2]}"`);
});

test('Cost Basis appears exactly once on the card', (t) => {
  const { window, teardown } = setupJsdom({ trades: baseTrades });
  t.after(teardown);
  const card = getHcard(window);
  const labels = Array.from(card.querySelectorAll('.hcard-stat-lbl'))
    .map(el => el.textContent.trim());
  const cbCount = labels.filter(l => /^Cost Basis$/i.test(l)).length;
  assert.strictEqual(cbCount, 1, 'Cost Basis should appear exactly once');
});
