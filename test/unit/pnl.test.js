const test = require('node:test');
const assert = require('node:assert');
const { computePnl } = require('../../src/js/05b-pnl.js');

test('PUT EXPIRED → realised = netPrem', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 120);
});

test('PUT ASSIGNED → realised = netPrem (capital gain only on later call-away)', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 200);
});

test('CALL CALLED on assigned lot → realised += netPrem + (strike − costBasis) × calledSize', () => {
  // PUT assigned at 50000 (size 0.1) → costBasis=50000. Later CALL at 55000 size 0.1, premium 80.
  // Realised = 200 (put prem) + 80 (call prem) + (55000-50000)*0.1 = 280 + 500 = 780
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'CALL', date: '2026-01-20', expiry: '2026-02-03',
      strike: 55000, size: 0.1, premium: 80, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 780);
});

test('CALL CALLED on HOLDING-originated lot → capital gain counted same as ASSIGNED (no special case)', () => {
  // HOLDING bought at 3000 size 1. CALL at 3500 size 1 premium 50, called.
  // Realised = 50 (call prem) + (3500-3000)*1 = 550
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 550);
});

test('CALL EXPIRED on open lot → realised += netPrem', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-05', expiry: '2026-01-19',
      strike: 3500, size: 1, premium: 60, outcome: 'EXPIRED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 60);
});

test('CALL CLOSED with closeCost > premium → realised takes negative netPrem cleanly', () => {
  // Buy-to-close at a loss: premium 50, closeCost 80 → netPrem = -30
  const trades = [
    { id: 1, asset: 'HYPE', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 30, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'HYPE', type: 'CALL', date: '2026-01-10', expiry: '2026-01-24',
      strike: 35, size: 100, premium: 50, outcome: 'CLOSED', closeCost: 80 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, -30);
});

test('OPEN option contributes 0 to realised', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'OPEN', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 0);
});

test('partial call-away realises only calledSize × (strike − costBasis)', () => {
  // Lot opens at 3000, size 2 (HOLDING). CALL at 3500 size 1 (partial), called.
  // Realised = 40 (premium) + (3500-3000)*1 = 540. Lot remains open with size 1.
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 2, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      strike: 3500, size: 1, premium: 40, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 540);
});

test('asset filter scopes realised to one asset', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 100, outcome: 'EXPIRED', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 3000, size: 1, premium: 50, outcome: 'EXPIRED', closeCost: 0 },
  ];
  assert.strictEqual(computePnl(trades, 'BTC').realised, 100);
  assert.strictEqual(computePnl(trades, 'ETH').realised, 50);
  assert.strictEqual(computePnl(trades, 'ALL').realised, 150);
  assert.strictEqual(computePnl(trades).realised, 150);
});

test('empty trades → realised = 0', () => {
  assert.strictEqual(computePnl([]).realised, 0);
});
