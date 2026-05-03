const test = require('node:test');
const assert = require('node:assert');

// compute() reads `trades` and calls `lotEngine` from the global scope, since
// in the browser they're concatenated into one script. Wire both before requiring.
global.lotEngine = require('../../src/js/04b-lot-engine.js').lotEngine;

test('compute derives netCost = costBasis - lotPremiums/size for each open lot', () => {
  global.trades = [
    // BTC lot 1: HOLDING + one call
    { id: 1, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', strike: 50000, size: 0.1, premium: 0,   outcome: 'OPEN',   closeCost: 0, dte: null, expiry: '' },
    { id: 2, asset: 'BTC', type: 'CALL',    date: '2026-01-15', strike: 55000, size: 0.1, premium: 100, outcome: 'EXPIRED', closeCost: 0, dte: 14, expiry: '2026-01-29' },
    // BTC lot 2: assigned PUT
    { id: 3, asset: 'BTC', type: 'PUT',     date: '2026-02-01', strike: 48000, size: 0.05, premium: 60, outcome: 'ASSIGNED', closeCost: 0, dte: 21, expiry: '2026-02-22' },
  ];
  const { compute } = require('../../src/js/05-compute.js');
  const { lots } = compute('ALL');

  assert.strictEqual(lots.BTC.length, 2);

  // Lot 1: costBasis 50000, lotPremiums 100 (call only), size 0.1 → 50000 - 100/0.1 = 49000
  assert.strictEqual(lots.BTC[0].netCost, 49000);

  // Lot 2: costBasis 48000, lotPremiums 60 (assigned-PUT premium), size 0.05 → 48000 - 60/0.05 = 46800
  assert.strictEqual(lots.BTC[1].netCost, 46800);
});
