const test = require('node:test');
const assert = require('node:assert');
const { fmt } = require('../../src/js/02-utils.js');

test('fmt does not round strikes (max 2dp, never 0dp)', () => {
  assert.strictEqual(fmt(63000),     '63,000');
  assert.strictEqual(fmt(63000.5),   '63,000.5');
  assert.strictEqual(fmt(0.05),      '0.05');
  assert.strictEqual(fmt(1234.567),  '1,234.57'); // rounded to 2dp, not 0dp
  assert.strictEqual(fmt(0.001),     '0');         // sub-penny rounds via 2dp cap (not via int truncation)
});
