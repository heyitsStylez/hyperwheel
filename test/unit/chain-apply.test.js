const test = require('node:test');
const assert = require('node:assert');
const { applyCloseTrade, applyImportedTrades } = require('../../src/js/18b-chain-apply.js');

const PAST_DATE   = '2020-01-01';
const FUTURE_DATE = '2099-12-31';

// ── applyCloseTrade ──────────────────────────────────────────────────────────

test('applyCloseTrade: matches OPEN trade and sets CLOSED + closeCost', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 10, outcome: 'OPEN' },
  ];
  const result = applyCloseTrade(arr, { asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 3 });
  assert.strictEqual(result, true);
  assert.strictEqual(arr[0].outcome, 'CLOSED');
  assert.strictEqual(arr[0].closeCost, 3);
});

test('applyCloseTrade: no match on strike → returns false, no mutation', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 10, outcome: 'OPEN' },
  ];
  const result = applyCloseTrade(arr, { asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 35, premium: 3 });
  assert.strictEqual(result, false);
  assert.strictEqual(arr[0].outcome, 'OPEN');
});

test('applyCloseTrade: non-OPEN trade is not matched', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 10, outcome: 'EXPIRED' },
  ];
  const result = applyCloseTrade(arr, { asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 3 });
  assert.strictEqual(result, false);
});

// ── applyImportedTrades ──────────────────────────────────────────────────────

test('applyImportedTrades: pushes open trade and strips isClose field', () => {
  const arr = [];
  const synced = new Set();
  const open = [{ id: 1, asset: 'HYPE', type: 'PUT', expiry: FUTURE_DATE, outcome: 'OPEN', isClose: false, txHash: 'tx1' }];
  const { added } = applyImportedTrades(arr, open, [], synced);
  assert.strictEqual(added, 1);
  assert.strictEqual(arr.length, 1);
  assert.strictEqual('isClose' in arr[0], false, 'isClose must be stripped from pushed trade');
  assert.ok(synced.has('tx1'));
});

test('applyImportedTrades: already-synced txHash is skipped', () => {
  const arr = [];
  const synced = new Set(['tx1']);
  const open = [{ id: 1, asset: 'HYPE', type: 'PUT', expiry: FUTURE_DATE, outcome: 'OPEN', isClose: false, txHash: 'tx1' }];
  const { added } = applyImportedTrades(arr, open, [], synced);
  assert.strictEqual(added, 0);
  assert.strictEqual(arr.length, 0);
});

test('applyImportedTrades: close trade matches open → CLOSED, closedCount: 1', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 10, outcome: 'OPEN' },
  ];
  const synced = new Set();
  const close = [{ asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 30, premium: 3, isClose: true, txHash: 'tx-c' }];
  const { closedCount } = applyImportedTrades(arr, [], close, synced);
  assert.strictEqual(closedCount, 1);
  assert.strictEqual(arr[0].outcome, 'CLOSED');
  assert.strictEqual(arr[0].closeCost, 3);
  assert.ok(synced.has('tx-c'));
});

test('applyImportedTrades: unknown close trade with no match → closedCount: 0', () => {
  const arr = [];
  const synced = new Set();
  const close = [{ asset: 'HYPE', type: 'PUT', expiry: '2026-05-01', strike: 99, premium: 3, isClose: true, txHash: 'tx-c' }];
  const { closedCount } = applyImportedTrades(arr, [], close, synced);
  assert.strictEqual(closedCount, 0);
});

test('applyImportedTrades: OPEN RYSK trade with past expiry corrected to EXPIRED', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: PAST_DATE, outcome: 'OPEN', platform: 'RYSK' },
  ];
  const { corrected } = applyImportedTrades(arr, [], [], new Set());
  assert.strictEqual(corrected, 1);
  assert.strictEqual(arr[0].outcome, 'EXPIRED');
});

test('applyImportedTrades: OPEN HSFC trade with past expiry corrected to EXPIRED', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: PAST_DATE, outcome: 'OPEN', platform: 'HSFC' },
  ];
  const { corrected } = applyImportedTrades(arr, [], [], new Set());
  assert.strictEqual(corrected, 1);
  assert.strictEqual(arr[0].outcome, 'EXPIRED');
});

test('applyImportedTrades: OPEN trade with future expiry is not corrected', () => {
  const arr = [
    { id: 1, asset: 'HYPE', type: 'PUT', expiry: FUTURE_DATE, outcome: 'OPEN', platform: 'RYSK' },
  ];
  const { corrected } = applyImportedTrades(arr, [], [], new Set());
  assert.strictEqual(corrected, 0);
  assert.strictEqual(arr[0].outcome, 'OPEN');
});
