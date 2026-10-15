const { test } = require('node:test');
const assert = require('node:assert');
const { rollTrade } = require('../../src/js/tradfi/21-roll.js');

const put = { id: 1, asset: 'AAPL', type: 'PUT', date: '2026-10-01', expiry: '2026-10-17', dte: 16,
  strike: 200, size: 100, premium: 150, outcome: 'OPEN', closeCost: 0, closeDate: '', platform: 'MANUAL' };
const p = { closeCost: 220, date: '2026-10-15', expiry: '2026-11-21', strike: 195, size: 100, premium: 310 };

test('roll closes the old leg and opens a linked replacement', () => {
  const out = rollTrade([put], 1, p);
  assert.strictEqual(out.length, 2);
  const [old, next] = out;
  assert.deepStrictEqual([old.outcome, old.closeCost, old.closeDate], ['CLOSED', 220, '2026-10-15']);
  assert.strictEqual(old.premium, 150);
  assert.strictEqual(next.outcome, 'OPEN');
  assert.strictEqual(next.type, 'PUT');
  assert.strictEqual(next.platform, 'MANUAL');
  assert.strictEqual(next.rolledFrom, 1);
  assert.strictEqual(next.dte, 37);
  assert.deepStrictEqual([next.strike, next.size, next.premium, next.date], [195, 100, 310, '2026-10-15']);
  assert.ok(next.id > old.id);
  assert.strictEqual(put.outcome, 'OPEN', 'input not mutated');
});

test('rolled CALL keeps its lotNum', () => {
  const call = { ...put, type: 'CALL', lotNum: 2 };
  assert.strictEqual(rollTrade([call], 1, p)[1].lotNum, 2);
  assert.ok(!('lotNum' in rollTrade([put], 1, p)[1]));
});

test('only open options roll', () => {
  assert.strictEqual(rollTrade([{ ...put, outcome: 'EXPIRED' }], 1, p), null);
  assert.strictEqual(rollTrade([{ ...put, type: 'HOLDING' }], 1, p), null);
  assert.strictEqual(rollTrade([put], 99, p), null);
});
