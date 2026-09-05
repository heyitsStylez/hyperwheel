const test = require('node:test');
const assert = require('node:assert');
const { monthlySummary } = require('../../src/js/core/07c-render-monthly-summary.js');
const { computePnl } = require('../../src/js/core/05b-pnl.js');
// monthlySummary reaches for a global computePnl first; provide it for Node.
global.computePnl = computePnl;
global.lotEngine = require('../../src/js/core/04b-lot-engine.js').lotEngine;

test('sums premium + counts settled trades bucketed by realisation month', () => {
  const trades = [
    // settled in Aug — counted
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-08-03', expiry: '2026-08-14',
      strike: 60, size: 100, premium: 226, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
    // CLOSED-early — buckets on closeDate (Aug), premium is gross (not net of closeCost)
    { id: 2, asset: 'IBIT', type: 'CALL', date: '2026-08-01', expiry: '2026-09-05',
      strike: 65, size: 100, premium: 100, outcome: 'CLOSED', closeCost: 15, closeDate: '2026-08-11' },
    // OPEN — excluded
    { id: 3, asset: 'IBIT', type: 'PUT', date: '2026-08-20', expiry: '2026-09-18',
      strike: 58, size: 100, premium: 300, outcome: 'OPEN', closeCost: 0, closeDate: '' },
    // HOLDING — excluded
    { id: 4, asset: 'IBIT', type: 'HOLDING', date: '2026-08-14',
      strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, closeDate: '' },
  ];
  const s = monthlySummary(trades, 'ALL', '2026-08');
  assert.strictEqual(s.premium, 326, 'gross premium of the two settled options');
  assert.strictEqual(s.tradeCount, 2);
});

test('netPnl matches computePnl realisedByMonth for the month', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-07-03', expiry: '2026-07-14',
      strike: 60, size: 100, premium: 200, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
    { id: 2, asset: 'IBIT', type: 'CALL', date: '2026-08-01', expiry: '2026-08-28',
      strike: 65, size: 100, premium: 100, outcome: 'CLOSED', closeCost: 15, closeDate: '2026-08-11' },
  ];
  const { realisedByMonth } = computePnl(trades, 'ALL', {});
  assert.strictEqual(monthlySummary(trades, 'ALL', '2026-08').netPnl, realisedByMonth['2026-08']);
  assert.strictEqual(monthlySummary(trades, 'ALL', '2026-08').netPnl, 85, '100 − 15 close cost');
  assert.strictEqual(monthlySummary(trades, 'ALL', '2026-07').netPnl, 200);
});

test('empty month yields zeros', () => {
  const s = monthlySummary([], 'ALL', '2026-08');
  assert.deepStrictEqual(s, { ym: '2026-08', premium: 0, tradeCount: 0, netPnl: 0 });
});
