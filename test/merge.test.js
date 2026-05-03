const test = require('node:test');
const assert = require('node:assert');

const { mergeOpenLots } = require('../src/js/05a-merge-open-lots.js');

test('merging two open HOLDING lots for an asset produces a single merged lot with weighted cost and summed size', () => {
  const trades = [
    { id: 100, asset: 'BTC', type: 'HOLDING', date: '2023-01-01', strike: 10000, size: 0.5, premium: 0 },
    { id: 200, asset: 'BTC', type: 'HOLDING', date: '2023-02-01', strike: 12000, size: 0.25, premium: 0 },
    { id: 300, asset: 'ETH', type: 'HOLDING', date: '2023-03-01', strike: 2000, size: 1, premium: 0 },
  ];

  const merged = mergeOpenLots(trades, 'BTC');

  // Expect one BTC holding (kept earliest id 100) and the ETH holding untouched
  const btcTrades = merged.filter(t => t.asset === 'BTC');
  assert.strictEqual(btcTrades.length, 1, 'Should have one BTC trade after merge');

  const keep = btcTrades[0];
  assert.strictEqual(keep.id, 100, 'Kept trade should be the earliest opener (id 100)');

  const expectedSize = 0.5 + 0.25;
  const expectedAvg = (10000 * 0.5 + 12000 * 0.25) / expectedSize;

  assert.strictEqual(keep.size, expectedSize);
  assert.strictEqual(keep.strike, expectedAvg);

  // Non-target asset still present
  const eth = merged.find(t => t.asset === 'ETH');
  assert(eth, 'ETH holding should remain unchanged');
});
