const test = require('node:test');
const assert = require('node:assert');
const { lotEngine } = require('../../src/js/04b-lot-engine.js');

test('assigned PUT credits its net premium to the new lot lotPremiums (May 2026 fix)', () => {
  const { lots, portfolioPnl } = lotEngine([
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
  ]);
  assert.strictEqual(lots.length, 1);
  assert.strictEqual(lots[0].costBasis, 50000);
  assert.strictEqual(lots[0].size, 0.1);
  assert.strictEqual(lots[0].lotPremiums, 200, 'put net premium should credit the new lot');
  // netCost = 50000 - 200/0.1 = 48000
  assert.strictEqual(lots[0].netCost, 48000);
  // portfolioPnl = +200 (premium) - 50000*0.1 (assignment) = -4800
  assert.strictEqual(portfolioPnl, -4800);
});

test('CALLED reduces lot size and credits strike*calledSize to portfolio P&L', () => {
  const { lots, portfolioPnl } = lotEngine([
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL',    date: '2026-01-15', strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ]);
  assert.strictEqual(lots.length, 1);
  assert.strictEqual(lots[0].open, false, 'lot should close when fully called away');
  assert.strictEqual(lots[0].size, 0);
  assert.strictEqual(lots[0].exitStrike, 3500);
  // portfolioPnl = +50 (call premium) + 3500*1 (called proceeds) = 3550
  assert.strictEqual(portfolioPnl, 3550);
});

test('CLOSED CALL keeps lot open and reduces premium by closeCost (Hypersurface buy-to-close)', () => {
  const { lots, portfolioPnl } = lotEngine([
    { id: 1, asset: 'HYPE', type: 'HOLDING', date: '2026-01-01', strike: 30, size: 100, premium: 0,  outcome: 'OPEN',   closeCost: 0  },
    { id: 2, asset: 'HYPE', type: 'CALL',    date: '2026-01-10', strike: 35, size: 100, premium: 80, outcome: 'CLOSED', closeCost: 30 },
  ]);
  assert.strictEqual(lots.length, 1);
  assert.strictEqual(lots[0].open, true, 'CLOSED outcome must not close the lot');
  assert.strictEqual(lots[0].size, 100);
  // netPrem = 80 - 30 = 50, all credited to lotPremiums
  assert.strictEqual(lots[0].lotPremiums, 50);
  assert.strictEqual(portfolioPnl, 50);
});
