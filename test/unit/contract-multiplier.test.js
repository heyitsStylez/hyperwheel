const test = require('node:test');
const assert = require('node:assert');

// contractsToShares/sharesToContracts read the per-asset multiplier from
// contractMultiplier (01b), which lives in the global scope once the concatenated
// scripts run in the browser. Mirror that here: expose 01b's exports as globals
// before requiring 02-utils, and register the futures multiplier as the tradfi
// module does at load.
const meta = require('../../src/js/core/01b-asset-meta.js');
global.ASSET_MULTIPLIER = meta.ASSET_MULTIPLIER;
global.contractMultiplier = meta.contractMultiplier;
Object.assign(global.ASSET_MULTIPLIER, { MES: 5 });

const { SHARES_PER_CONTRACT, contractsToShares, sharesToContracts, entryMultiplier } = require('../../src/js/core/02-utils.js');

test('SHARES_PER_CONTRACT is the equity default of 100', () => {
  assert.strictEqual(SHARES_PER_CONTRACT, 100);
});

test('contractMultiplier defaults to 100 and overrides for futures', () => {
  assert.strictEqual(meta.contractMultiplier('AAPL'), 100);
  assert.strictEqual(meta.contractMultiplier(undefined), 100);
  assert.strictEqual(meta.contractMultiplier('MES'), 5);
});

test('contractsToShares multiplies by 100 for equities (default)', () => {
  assert.strictEqual(contractsToShares(1), 100);
  assert.strictEqual(contractsToShares(3, 'AAPL'), 300);
  assert.strictEqual(contractsToShares(0.5), 50);
});

test('sharesToContracts divides by 100 for equities (inverse)', () => {
  assert.strictEqual(sharesToContracts(100), 1);
  assert.strictEqual(sharesToContracts(300, 'AAPL'), 3);
  assert.strictEqual(sharesToContracts(contractsToShares(7)), 7);
});

test('MES uses the $5 futures multiplier and round-trips', () => {
  assert.strictEqual(contractsToShares(1, 'MES'), 5);
  assert.strictEqual(contractsToShares(4, 'MES'), 20);
  assert.strictEqual(sharesToContracts(20, 'MES'), 4);
  assert.strictEqual(sharesToContracts(contractsToShares(3, 'MES'), 'MES'), 3);
});

test('entryMultiplier: equity holdings ×1 (shares), everything else ×multiplier', () => {
  assert.strictEqual(entryMultiplier('AAPL', true), 1);   // equity holding = raw shares
  assert.strictEqual(entryMultiplier('AAPL', false), 100); // equity option = contracts
  assert.strictEqual(entryMultiplier('MES', true), 5);     // futures holding = contracts
  assert.strictEqual(entryMultiplier('MES', false), 5);    // futures option = contracts
});
