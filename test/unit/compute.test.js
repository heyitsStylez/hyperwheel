const test = require('node:test');
const assert = require('node:assert');

// compute() reads `trades` and calls `lotEngine` from the global scope, since
// in the browser they're concatenated into one script. Wire both before requiring.
global.lotEngine = require('../../src/js/core/04b-lot-engine.js').lotEngine;

test('compute derives netCost = costBasis - lotPremiums/size for each open lot', () => {
  global.trades = [
    // BTC lot 1: HOLDING + one call
    { id: 1, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', strike: 50000, size: 0.1, premium: 0,   outcome: 'OPEN',   closeCost: 0, dte: null, expiry: '' },
    { id: 2, asset: 'BTC', type: 'CALL',    date: '2026-01-15', strike: 55000, size: 0.1, premium: 100, outcome: 'EXPIRED', closeCost: 0, dte: 14, expiry: '2026-01-29' },
    // BTC lot 2: assigned PUT
    { id: 3, asset: 'BTC', type: 'PUT',     date: '2026-02-01', strike: 48000, size: 0.05, premium: 60, outcome: 'ASSIGNED', closeCost: 0, dte: 21, expiry: '2026-02-22' },
  ];
  const { compute } = require('../../src/js/core/05-compute.js');
  const { lots } = compute('ALL');

  assert.strictEqual(lots.BTC.length, 2);

  // Lot 1: costBasis 50000, lotPremiums 100 (call only), size 0.1 → 50000 - 100/0.1 = 49000
  assert.strictEqual(lots.BTC[0].netCost, 49000);

  // Lot 2: costBasis 48000, lotPremiums 60 (assigned-PUT premium), size 0.05 → 48000 - 60/0.05 = 46800
  assert.strictEqual(lots.BTC[1].netCost, 46800);
});

test('compute derives the roster from trades[] — arbitrary tickers work', () => {
  global.trades = [
    { id: 1, asset: 'TSLA', type: 'HOLDING', date: '2026-01-01', strike: 200, size: 10, premium: 0,  outcome: 'OPEN',    closeCost: 0, dte: null, expiry: '' },
    { id: 2, asset: 'TSLA', type: 'CALL',    date: '2026-01-15', strike: 240, size: 10, premium: 50, outcome: 'EXPIRED', closeCost: 0, dte: 14,   expiry: '2026-01-29' },
    { id: 3, asset: 'AAPL', type: 'HOLDING', date: '2026-02-01', strike: 180, size: 5,  premium: 0,  outcome: 'OPEN',    closeCost: 0, dte: null, expiry: '' },
  ];
  const { compute } = require('../../src/js/core/05-compute.js');
  const { streams, lots } = compute('ALL');

  // Streams/lots exist only for the tickers present in trades — no fixed four.
  assert.deepStrictEqual(Object.keys(lots).sort(), ['AAPL', 'TSLA']);
  assert.deepStrictEqual(Object.keys(streams).sort(), ['AAPL', 'TSLA']);

  // TSLA lot: costBasis 200, lotPremiums 50 (call), size 10 → 200 - 50/10 = 195
  assert.strictEqual(lots.TSLA[0].netCost, 195);
});

test('CLOSED APR annualises over days held; rolled legs get no APR', () => {
  global.trades = [
    // Closed early: held 6 of 11 days. net 51 / 7550 collateral → annualised over 6d.
    { id: 1, asset: 'MES', type: 'PUT', date: '2026-09-28', expiry: '2026-10-09', dte: 11, strike: 7550, size: 1, premium: 68.5, closeCost: 17.5, closeDate: '2026-10-04', outcome: 'CLOSED' },
    // Closed with no closeDate: falls back to the full term.
    { id: 2, asset: 'MES', type: 'PUT', date: '2026-09-01', expiry: '2026-09-11', dte: 10, strike: 7000, size: 1, premium: 50, closeCost: 10, closeDate: '', outcome: 'CLOSED' },
    // Rolled leg (id 3 → 4): APR suppressed.
    { id: 3, asset: 'PURR', type: 'PUT', date: '2026-10-06', expiry: '2026-11-20', dte: 45, strike: 11, size: 200, premium: 160, closeCost: 448, closeDate: '2026-10-15', outcome: 'CLOSED' },
    { id: 4, asset: 'PURR', type: 'PUT', date: '2026-10-15', expiry: '2027-03-19', dte: 155, strike: 10, size: 200, premium: 502, closeCost: 0, closeDate: '', outcome: 'OPEN', rolledFrom: 3 },
  ];
  const { compute } = require('../../src/js/core/05-compute.js');
  const row = id => compute('ALL').allRows.find(r => r.id === id);

  assert.strictEqual(row(1).annual.toFixed(1), (51 / 7550 * 100 / 6 * 365).toFixed(1));
  assert.strictEqual(row(2).annual.toFixed(1), (40 / 7000 * 100 / 10 * 365).toFixed(1));
  assert.strictEqual(row(3).annual, null);
  assert.strictEqual(row(3).monthly, null);
  assert.strictEqual(row(4).annual.toFixed(1), (502 / 2000 * 100 / 155 * 365).toFixed(1));
});
