const { test } = require('node:test');
const assert = require('assert');
const { lotNetCost } = require('../src/js/04c-lot-netcost.js');

test('lotNetCost computes net cost when size > 0', () => {
  const res = lotNetCost(10, 100, 50);
  assert.strictEqual(res, 100 - (50 / 10));
});

test('lotNetCost returns null when size === 0', () => {
  assert.strictEqual(lotNetCost(0, 100, 50), null);
});
