const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('loadTrades() reads persisted trades from the seam on boot', async (t) => {
  const seed = [{ id: 1, asset: 'BTC', type: 'HOLDING', strike: 50000, size: 0.1, outcome: 'OPEN', platform: 'SPOT' }];
  const { window, teardown } = await setupJsdom({ trades: seed });
  t.after(teardown);

  const loaded = await window.loadTrades();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 1);
});

test('persist() writes hw_holdings and can be round-tripped by loadTrades()', async (t) => {
  const { window, teardown } = await setupJsdom();
  t.after(teardown);

  const next = [{ id: 2, asset: 'ETH', type: 'HOLDING', strike: 3000, size: 1, outcome: 'OPEN', platform: 'SPOT' }];
  await window.persist(next);

  assert.strictEqual(window.localStorage.getItem('hw_holdings'), JSON.stringify(next));
  assert.strictEqual(JSON.stringify(await window.loadTrades()), JSON.stringify(next));
});

test('currentUserKey() returns the wallet-derived key', async (t) => {
  const wallet = '0x' + 'a'.repeat(40);
  const { window, teardown } = await setupJsdom({ wallet });
  t.after(teardown);

  assert.strictEqual(window.currentUserKey(), wallet);
});
