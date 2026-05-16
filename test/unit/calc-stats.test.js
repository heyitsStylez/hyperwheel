const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

// Wire up globals needed by the dual-export require chain
global.trades = [];
global.livePrices = {};

const { calcPremiumStats } = require('../../src/js/05d-calc-stats.js');

function makeRow(overrides) {
  return Object.assign({
    type: 'PUT',
    outcome: 'EXPIRED',
    premium: 100,
    closeCost: 0,
    strike: 1000,
    size: 1,
    annual: 50,
  }, overrides);
}

describe('calcPremiumStats', () => {
  it('excludes HOLDING trades from all counts', () => {
    const rows = [
      makeRow({ type: 'HOLDING', premium: 0, strike: 1000, size: 1 }),
    ];
    const s = calcPremiumStats(rows);
    assert.equal(s.totalCount, 0);
    assert.equal(s.totalPrem, 0);
    assert.equal(s.totalNotional, 0);
  });

  it('returns null returnRate when no settled trades', () => {
    const rows = [makeRow({ outcome: 'OPEN' })];
    const s = calcPremiumStats(rows);
    assert.equal(s.returnRate, null);
    assert.equal(s.settled, 0);
    assert.equal(s.openCount, 1);
  });

  it('returns 100% returnRate when all settled trades expired OTM', () => {
    const rows = [
      makeRow({ outcome: 'EXPIRED' }),
      makeRow({ outcome: 'EXPIRED' }),
    ];
    const s = calcPremiumStats(rows);
    assert.equal(s.returnRate, 100);
    assert.equal(s.otmCount, 2);
    assert.equal(s.itmCount, 0);
    assert.equal(s.settled, 2);
  });

  it('computes portfolioAPR as notional-weighted average of annual', () => {
    // notional = strike * size
    // row1: notional=1000, annual=40  → weight contrib = 40000
    // row2: notional=2000, annual=60  → weight contrib = 120000
    // weighted avg = 160000 / 3000 ≈ 53.333...
    const rows = [
      makeRow({ outcome: 'EXPIRED', strike: 1000, size: 1, annual: 40 }),
      makeRow({ outcome: 'EXPIRED', strike: 1000, size: 2, annual: 60 }),
    ];
    const s = calcPremiumStats(rows);
    assert.ok(Math.abs(s.portfolioAPR - (40 * 1000 + 60 * 2000) / 3000) < 0.001);
  });

  it('returns correct shape with expected keys', () => {
    const s = calcPremiumStats([]);
    const expected = ['totalPrem', 'totalNotional', 'totalCount', 'otmCount', 'itmCount', 'openCount', 'settled', 'returnRate', 'portfolioAPR'];
    for (const k of expected) {
      assert.ok(Object.prototype.hasOwnProperty.call(s, k), `missing key: ${k}`);
    }
    // dead fields must not be present
    assert.ok(!Object.prototype.hasOwnProperty.call(s, 'assignmentLoss'));
    assert.ok(!Object.prototype.hasOwnProperty.call(s, 'callAwayCredit'));
    assert.ok(!Object.prototype.hasOwnProperty.call(s, 'netPnl'));
  });
});
