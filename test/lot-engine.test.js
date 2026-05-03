const { test } = require('node:test');
const assert = require('assert');
const { lotEngine } = require('../src/js/04b-lot-engine.js');

// Small trade history exercising HOLDING, ASSIGNED PUT, CALL attach, CALLED
const trades = [
  { id: 1, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', strike: 1000, size: 1, premium: 0, outcome: 'OPEN' },
  { id: 2, asset: 'BTC', type: 'PUT', date: '2026-01-02', strike: 900, size: 1, premium: 50, outcome: 'ASSIGNED' },
  { id: 3, asset: 'BTC', type: 'CALL', date: '2026-01-03', strike: 1100, size: 1, premium: 20, outcome: 'OPEN', lotNum: 2 },
  { id: 4, asset: 'BTC', type: 'CALL', date: '2026-01-04', strike: 1200, size: 1, premium: 0, outcome: 'CALLED', lotNum: 2 },
];

test('lotEngine emits timeline and enforces invariants', () => {
  const engine = lotEngine(trades);

  // timeline length equals number of trades processed
  assert.strictEqual(engine.timeline.length, trades.length);

  // timeline is date-ordered
  for (let i = 1; i < engine.timeline.length; i++) {
    assert.ok(engine.timeline[i].date >= engine.timeline[i-1].date);
  }

  // ASSIGNED PUT: lot created with lotPremiums == netPrem (50)
  const asgSnap = engine.tradeAccounting[2];
  assert.ok(asgSnap.lot, 'Assigned trade should have opened a lot');
  assert.strictEqual(asgSnap.lot.lotPremiums, 50);
  // Running PnL after assignment = netPrem - strike*size
  assert.strictEqual(asgSnap.runningPnl, 50 - (900 * 1));

  // CALL attach: premium added to lotPremiums
  const callSnap = engine.tradeAccounting[3];
  assert.ok(callSnap.lot, 'Call attach should reference a lot');
  assert.strictEqual(callSnap.lot.lotPremiums, 50 + 20);

  // CALLED: lot size reduced/closed and portfolioPnl credited by strike*calledSize
  const calledSnap = engine.tradeAccounting[4];
  // After called, runningPnl should be previous + 1200
  assert.strictEqual(calledSnap.runningPnl, 370);
  const lot = engine.lots.find(l => l.lotNum === 2);
  assert.ok(lot.size === 0 || lot.open === false, 'Lot should be closed or size zero');
});
