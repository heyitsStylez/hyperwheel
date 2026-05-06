const test = require('node:test');
const assert = require('node:assert');
const { outcomeDistribution } = require('../../src/js/05c-outcome-distribution.js');

test('empty trades → empty array', () => {
  assert.deepStrictEqual(outcomeDistribution([]), []);
});

test('OPEN-only trades → empty array', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', outcome: 'OPEN', premium: 100, closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', outcome: 'OPEN', premium: 50, closeCost: 0 },
  ];
  assert.deepStrictEqual(outcomeDistribution(trades), []);
});

test('one trade per outcome → all four entries in canonical order', () => {
  const trades = [
    { id: 4, asset: 'BTC', type: 'CALL', outcome: 'CLOSED',  premium: 100, closeCost: 30 },
    { id: 3, asset: 'BTC', type: 'CALL', outcome: 'CALLED',  premium: 80,  closeCost: 0 },
    { id: 1, asset: 'BTC', type: 'PUT',  outcome: 'EXPIRED', premium: 50,  closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'PUT',  outcome: 'ASSIGNED',premium: 60,  closeCost: 0 },
  ];
  const dist = outcomeDistribution(trades);
  assert.deepStrictEqual(dist.map(d => d.outcome), ['EXPIRED', 'ASSIGNED', 'CALLED', 'CLOSED']);
  assert.deepStrictEqual(dist.map(d => d.count),   [1, 1, 1, 1]);
  assert.deepStrictEqual(dist.map(d => d.premium), [50, 60, 80, 70]); // CLOSED: 100 - 30
});

test('multiple trades per outcome → counts and premium summed', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT',  outcome: 'EXPIRED', premium: 50, closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'PUT',  outcome: 'EXPIRED', premium: 70, closeCost: 0 },
    { id: 3, asset: 'BTC', type: 'CALL', outcome: 'CALLED',  premium: 80, closeCost: 0 },
  ];
  const dist = outcomeDistribution(trades);
  assert.strictEqual(dist.find(d => d.outcome === 'EXPIRED').count, 2);
  assert.strictEqual(dist.find(d => d.outcome === 'EXPIRED').premium, 120);
  assert.strictEqual(dist.find(d => d.outcome === 'CALLED').count, 1);
});

test('asset filter applied → only matching asset trades counted', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', outcome: 'EXPIRED',  premium: 100, closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'PUT', outcome: 'EXPIRED',  premium: 200, closeCost: 0 },
    { id: 3, asset: 'ETH', type: 'PUT', outcome: 'ASSIGNED', premium: 50,  closeCost: 0 },
  ];
  const dist = outcomeDistribution(trades, 'ETH');
  assert.strictEqual(dist.find(d => d.outcome === 'EXPIRED').premium, 200);
  assert.strictEqual(dist.find(d => d.outcome === 'EXPIRED').count, 1);
  assert.strictEqual(dist.find(d => d.outcome === 'ASSIGNED').count, 1);
});

test('CLOSED outcome subtracts closeCost from premium', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'CALL', outcome: 'CLOSED', premium: 200, closeCost: 75 },
    { id: 2, asset: 'BTC', type: 'CALL', outcome: 'CLOSED', premium: 100, closeCost: 120 },
  ];
  const dist = outcomeDistribution(trades);
  const closed = dist.find(d => d.outcome === 'CLOSED');
  assert.strictEqual(closed.count, 2);
  assert.strictEqual(closed.premium, 200 - 75 + 100 - 120); // 105
});

test('outcomes with zero count are omitted from result', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', outcome: 'EXPIRED', premium: 50, closeCost: 0 },
  ];
  const dist = outcomeDistribution(trades);
  assert.strictEqual(dist.length, 1);
  assert.strictEqual(dist[0].outcome, 'EXPIRED');
});

test('asset filter "ALL" treated same as no filter', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', outcome: 'EXPIRED', premium: 50, closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'PUT', outcome: 'EXPIRED', premium: 70, closeCost: 0 },
  ];
  assert.strictEqual(outcomeDistribution(trades, 'ALL').find(d => d.outcome === 'EXPIRED').count, 2);
});
