const test = require('node:test');
const assert = require('node:assert');
const { SHARES_PER_CONTRACT, contractsToShares, sharesToContracts } = require('../../src/js/core/02-utils.js');

test('contract multiplier is 100 shares', () => {
  assert.strictEqual(SHARES_PER_CONTRACT, 100);
});

test('contractsToShares multiplies by 100', () => {
  assert.strictEqual(contractsToShares(1), 100);
  assert.strictEqual(contractsToShares(3), 300);
  assert.strictEqual(contractsToShares(0.5), 50);
});

test('sharesToContracts divides by 100 (inverse)', () => {
  assert.strictEqual(sharesToContracts(100), 1);
  assert.strictEqual(sharesToContracts(300), 3);
  assert.strictEqual(sharesToContracts(contractsToShares(7)), 7);
});
