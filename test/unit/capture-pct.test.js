const test = require('node:test');
const assert = require('node:assert');
const { capturePct } = require('../../src/js/core/02-utils.js');

test('capturePct = (premium - closeCost) / premium * 100', () => {
  assert.strictEqual(capturePct(100, 9),  91);
  assert.strictEqual(capturePct(200, 70), 65);
  assert.strictEqual(capturePct(150, 0),  100); // closed for nothing → full capture
});

test('capturePct defaults missing closeCost to 0', () => {
  assert.strictEqual(capturePct(100), 100);
  assert.strictEqual(capturePct(100, undefined), 100);
});

test('capturePct returns null when there is no premium', () => {
  assert.strictEqual(capturePct(0, 5),         null);
  assert.strictEqual(capturePct(undefined, 5), null);
  assert.strictEqual(capturePct(null, 5),      null);
});

test('capturePct can go negative when closeCost exceeds premium', () => {
  assert.strictEqual(capturePct(100, 150), -50);
});
