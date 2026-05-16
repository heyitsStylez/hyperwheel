const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Helpers
const PAST_EXPIRY_TS   = Math.floor(Date.now() / 1000) - 86400;
const FUTURE_EXPIRY_TS = Math.floor(Date.now() / 1000) + 86400;
const PAST_EXPIRY_DATE   = new Date(PAST_EXPIRY_TS   * 1000).toISOString().split('T')[0];
const FUTURE_EXPIRY_DATE = new Date(FUTURE_EXPIRY_TS * 1000).toISOString().split('T')[0];

// Read outcome from localStorage (trades is a `let`, not on window).
// Caller must flush via window.save() first.
function storedOutcome(window, id) {
  const stored = JSON.parse(window.localStorage.getItem('hw_holdings') || '[]');
  return (stored.find(t => t.id === id) || {}).outcome;
}

function hsfcPosition({ isPut, strikePrice, expiryTimestamp, asset, redeemActions = [] }) {
  return {
    id: 'pos-' + Math.random(),
    oToken: {
      symbol: 'oTEST',
      strikePrice: String(strikePrice * 1e8),  // HSFC encodes at 1e8
      expiryTimestamp: String(expiryTimestamp),
      isPut,
      underlyingAsset: { symbol: asset },
    },
    redeemActions,
  };
}

function ryskPosition({ isPut, strike, expiry, txHash, address, collateral, status = 'SETTLED' }) {
  // Encode strike at 1e18. Use BigInt so large values (BTC, ETH) don't overflow to
  // scientific notation ("2.3e21"), which parseInt would misread as 2.
  // Real Rysk API returns integer strings like "2300000000000000000000".
  const strikeEncoded = String(BigInt(Math.round(strike * 1e6)) * 1000000000000n);
  return {
    status,
    expiry: String(expiry),
    strike: strikeEncoded,
    txHash,
    address,
    collateral,
    isPut,
  };
}

// ── resolveHsfcOutcomes ───────────────────────────────────────────────────────

test('resolveHsfcOutcomes: PUT with redeemActions → ASSIGNED', (t) => {
  const trade = {
    id: 1, asset: 'HYPE', type: 'PUT', platform: 'HSFC',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: 'key-1',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: true, strikePrice: 30.5, expiryTimestamp: PAST_EXPIRY_TS, asset: 'WHYPE', redeemActions: [{ id: 'r1' }] }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 1), 'ASSIGNED');
});

test('resolveHsfcOutcomes: CALL with redeemActions → CALLED', (t) => {
  const trade = {
    id: 2, asset: 'HYPE', type: 'CALL', platform: 'HSFC',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 41.5, size: 50, premium: 8, outcome: 'EXPIRED',
    closeCost: 0, txHash: 'key-2',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: false, strikePrice: 41.5, expiryTimestamp: PAST_EXPIRY_TS, asset: 'WHYPE', redeemActions: [{ id: 'r2' }] }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 2), 'CALLED');
});

test('resolveHsfcOutcomes: empty redeemActions → stays EXPIRED', (t) => {
  const trade = {
    id: 3, asset: 'HYPE', type: 'PUT', platform: 'HSFC',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: 'key-3',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: true, strikePrice: 30.5, expiryTimestamp: PAST_EXPIRY_TS, asset: 'WHYPE', redeemActions: [] }),
  ]);

  assert.strictEqual(changed, false);
  window.save();
  assert.strictEqual(storedOutcome(window, 3), 'EXPIRED');
});

test('resolveHsfcOutcomes: CLOSED trade is not touched', (t) => {
  const trade = {
    id: 4, asset: 'HYPE', type: 'PUT', platform: 'HSFC',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'CLOSED',
    closeCost: 5, txHash: 'key-4',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: true, strikePrice: 30.5, expiryTimestamp: PAST_EXPIRY_TS, asset: 'WHYPE', redeemActions: [{ id: 'r4' }] }),
  ]);

  assert.strictEqual(changed, false);
  window.save();
  assert.strictEqual(storedOutcome(window, 4), 'CLOSED');
});

test('resolveHsfcOutcomes: future expiry position is ignored', (t) => {
  const trade = {
    id: 5, asset: 'HYPE', type: 'PUT', platform: 'HSFC',
    date: '2026-05-01', expiry: FUTURE_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'OPEN',
    closeCost: 0, txHash: 'key-5',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: true, strikePrice: 30.5, expiryTimestamp: FUTURE_EXPIRY_TS, asset: 'WHYPE', redeemActions: [{ id: 'r5' }] }),
  ]);

  assert.strictEqual(changed, false);
  window.save();
  assert.strictEqual(storedOutcome(window, 5), 'OPEN');
});

test('resolveHsfcOutcomes: unknown asset symbol is skipped', (t) => {
  const trade = {
    id: 6, asset: 'HYPE', type: 'PUT', platform: 'HSFC',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: 'key-6',
  };
  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  const changed = window.resolveHsfcOutcomes([
    hsfcPosition({ isPut: true, strikePrice: 30.5, expiryTimestamp: PAST_EXPIRY_TS, asset: 'UNKNOWN', redeemActions: [{ id: 'r6' }] }),
  ]);

  assert.strictEqual(changed, false);
});

// ── resolveRyskOutcomes ───────────────────────────────────────────────────────
// resolveRyskOutcomes calls fetchRyskExpiryPrices (network). Stub window.fetch
// per-test to return a controlled expiry-prices response before calling the fn.

test('resolveRyskOutcomes: PUT settlementPrice <= strike → ASSIGNED', async (t) => {
  const UNDERLYING = '0x' + 'a'.repeat(40);
  const STRIKE_USD = 30.5;
  const SETTLE_USD = 29.0;  // below strike → ASSIGNED

  const trade = {
    id: 10, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: '0xhash10',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(SETTLE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash10', address: UNDERLYING, collateral: null }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 10), 'ASSIGNED');
});

test('resolveRyskOutcomes: PUT settlementPrice > strike → EXPIRED', async (t) => {
  const UNDERLYING = '0x' + 'a'.repeat(40);
  const STRIKE_USD = 30.5;
  const SETTLE_USD = 35.0;  // above strike → EXPIRED

  const trade = {
    id: 11, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 50, premium: 10, outcome: 'OPEN',
    closeCost: 0, txHash: '0xhash11',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(SETTLE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash11', address: UNDERLYING, collateral: null }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 11), 'EXPIRED');
});

test('resolveRyskOutcomes: CALL settlementPrice >= strike → CALLED', async (t) => {
  const COLLATERAL = '0x' + 'b'.repeat(40);
  const STRIKE_USD = 2300;
  const SETTLE_USD = 2500;  // above strike → CALLED

  const trade = {
    id: 12, asset: 'ETH', type: 'CALL', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 0.5, premium: 50, outcome: 'EXPIRED',
    closeCost: 0, txHash: '0xhash12',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(SETTLE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: false, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash12', address: null, collateral: COLLATERAL }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 12), 'CALLED');
});

test('resolveRyskOutcomes: CALL settlementPrice < strike → EXPIRED', async (t) => {
  const COLLATERAL = '0x' + 'b'.repeat(40);
  const STRIKE_USD = 2300;
  const SETTLE_USD = 2100;  // below strike → EXPIRED

  const trade = {
    id: 13, asset: 'ETH', type: 'CALL', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 0.5, premium: 50, outcome: 'OPEN',
    closeCost: 0, txHash: '0xhash13',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(SETTLE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: false, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash13', address: null, collateral: COLLATERAL }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 13), 'EXPIRED');
});

test('resolveRyskOutcomes: CLOSED trade is not touched', async (t) => {
  const UNDERLYING = '0x' + 'a'.repeat(40);
  const STRIKE_USD = 30.5;
  const SETTLE_USD = 28.0;  // would be ASSIGNED, but trade is CLOSED

  const trade = {
    id: 14, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 50, premium: 10, outcome: 'CLOSED',
    closeCost: 3, txHash: '0xhash14',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(SETTLE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash14', address: UNDERLYING, collateral: null }),
  ]);

  assert.strictEqual(changed, false);
  window.save();
  assert.strictEqual(storedOutcome(window, 14), 'CLOSED');
});

test('resolveRyskOutcomes: non-SETTLED position is skipped', async (t) => {
  const UNDERLYING = '0x' + 'a'.repeat(40);

  const trade = {
    id: 15, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-05-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'OPEN',
    closeCost: 0, txHash: '0xhash15',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  let fetchCalled = false;
  window.fetch = () => { fetchCalled = true; return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: 30.5, expiry: PAST_EXPIRY_TS, txHash: '0xhash15', address: UNDERLYING, collateral: null, status: 'ACTIVE' }),
  ]);

  assert.strictEqual(changed, false);
  assert.strictEqual(fetchCalled, false, 'should not fetch expiry prices for non-SETTLED positions');
  window.save();
  assert.strictEqual(storedOutcome(window, 15), 'OPEN');
});

test('resolveRyskOutcomes: expiry-prices fetch failure → no crash, outcome unchanged', async (t) => {
  const UNDERLYING = '0x' + 'a'.repeat(40);

  const trade = {
    id: 16, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: 30.5, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: '0xhash16',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.reject(new Error('Network error'));

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: 30.5, expiry: PAST_EXPIRY_TS, txHash: '0xhash16', address: UNDERLYING, collateral: null }),
  ]);

  assert.strictEqual(changed, false);
  window.save();
  assert.strictEqual(storedOutcome(window, 16), 'EXPIRED');
});

test('resolveRyskOutcomes: PUT at exact strike boundary → ASSIGNED', async (t) => {
  // settlementPrice exactly equals strike — PUT uses <=, so should be ASSIGNED
  const UNDERLYING = '0x' + 'a'.repeat(40);
  const STRIKE_USD = 30.5;

  const trade = {
    id: 17, asset: 'HYPE', type: 'PUT', platform: 'RYSK',
    date: '2026-04-01', expiry: PAST_EXPIRY_DATE,
    strike: STRIKE_USD, size: 50, premium: 10, outcome: 'EXPIRED',
    closeCost: 0, txHash: '0xhash17',
  };

  const { window, teardown } = setupJsdom({ trades: [trade] });
  t.after(teardown);

  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ [String(PAST_EXPIRY_TS)]: String(Math.round(STRIKE_USD * 1e8)) }),
  });

  const changed = await window.resolveRyskOutcomes([
    ryskPosition({ isPut: true, strike: STRIKE_USD, expiry: PAST_EXPIRY_TS, txHash: '0xhash17', address: UNDERLYING, collateral: null }),
  ]);

  assert.strictEqual(changed, true);
  window.save();
  assert.strictEqual(storedOutcome(window, 17), 'ASSIGNED');
});
