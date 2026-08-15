const test = require('node:test');
const assert = require('node:assert');
const { daysEarly } = require('../../src/js/core/02-utils.js');

test('daysEarly = expiry - closeDate in whole days', () => {
  assert.strictEqual(daysEarly('2026-08-20', '2026-08-15'), 5);
  assert.strictEqual(daysEarly('2026-08-20', '2026-08-20'), 0); // closed on expiry
  assert.strictEqual(daysEarly('2026-09-01', '2026-08-01'), 31);
});

test('daysEarly returns null when either date is missing', () => {
  assert.strictEqual(daysEarly('2026-08-20', ''), null);
  assert.strictEqual(daysEarly('', '2026-08-15'), null);
  assert.strictEqual(daysEarly(undefined, '2026-08-15'), null);
});

test('daysEarly is negative when closed after expiry', () => {
  assert.strictEqual(daysEarly('2026-08-15', '2026-08-20'), -5);
});
