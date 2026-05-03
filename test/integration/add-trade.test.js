const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('addTrade() from drawer pushes a HOLDING and persists to localStorage', (t) => {
  const { window, teardown } = setupJsdom();
  t.after(teardown);

  // Asset defaults to BTC; fill the form fields addTrade reads.
  window.document.getElementById('f-date').value = '2026-03-01';
  window.document.getElementById('f-strike').value = '52000';
  window.document.getElementById('f-size').value = '0.1';

  window.addTrade();

  const stored = JSON.parse(window.localStorage.getItem('hw_holdings'));
  assert.strictEqual(stored.length, 1);
  const trade = stored[0];
  assert.strictEqual(trade.asset, 'BTC');
  assert.strictEqual(trade.type, 'HOLDING');
  assert.strictEqual(trade.strike, 52000);
  assert.strictEqual(trade.size, 0.1);
  assert.strictEqual(trade.outcome, 'OPEN');
  assert.strictEqual(trade.platform, 'SPOT');
});
