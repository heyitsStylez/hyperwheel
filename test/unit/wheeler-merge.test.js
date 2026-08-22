const test = require('node:test');
const assert = require('node:assert');
const { mergeTradesById } = require('../../src/js/tradfi/12-cloud-sync.js');

const ids = arr => arr.map(t => t.id).sort((a, b) => a - b);

// ── The reported bug: a local-only trade must survive a cloud pull ────────────

test('mergeTradesById: local-only trade is never dropped by a newer remote', () => {
  const local  = [{ id: 1, asset: 'PURR' }, { id: 2, asset: 'IBIT' }]; // IBIT only local
  const remote = [{ id: 1, asset: 'PURR' }, { id: 3, asset: 'HOOD' }]; // HOOD only remote
  const merged = mergeTradesById(local, remote, /* preferRemote */ true);
  assert.deepStrictEqual(ids(merged), [1, 2, 3]);
});

test('mergeTradesById: remote-only trade is pulled in', () => {
  const local  = [{ id: 1 }];
  const remote = [{ id: 1 }, { id: 2 }];
  assert.deepStrictEqual(ids(mergeTradesById(local, remote, false)), [1, 2]);
});

// ── Shared-id conflicts resolve by the preferRemote flag ──────────────────────

test('mergeTradesById: preferRemote=true → remote version wins on shared id', () => {
  const local  = [{ id: 1, outcome: 'OPEN' }];
  const remote = [{ id: 1, outcome: 'CLOSED' }];
  const merged = mergeTradesById(local, remote, true);
  assert.strictEqual(merged.find(t => t.id === 1).outcome, 'CLOSED');
});

test('mergeTradesById: preferRemote=false → local version wins on shared id', () => {
  const local  = [{ id: 1, outcome: 'OPEN' }];
  const remote = [{ id: 1, outcome: 'CLOSED' }];
  const merged = mergeTradesById(local, remote, false);
  assert.strictEqual(merged.find(t => t.id === 1).outcome, 'OPEN');
});

// ── Convergence: merging equal sets is a no-op ────────────────────────────────

test('mergeTradesById: identical arrays merge to the same set', () => {
  const a = [{ id: 1 }, { id: 2 }];
  assert.deepStrictEqual(ids(mergeTradesById(a, a.slice(), true)), [1, 2]);
});

test('mergeTradesById: empty remote keeps all local trades', () => {
  const local = [{ id: 1 }, { id: 2 }];
  assert.deepStrictEqual(ids(mergeTradesById(local, [], true)), [1, 2]);
});
