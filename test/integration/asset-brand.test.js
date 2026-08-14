const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('crypto assets retain their brand colours; unknown ticker gets a hash colour', async (t) => {
  const { window, teardown } = await setupJsdom();
  t.after(teardown);

  assert.strictEqual(window.assetColor('BTC'), '#f7931a');
  assert.strictEqual(window.assetColor('ETH'), '#627eea');
  assert.strictEqual(window.assetColor('HYPE'), '#00e5a0');
  assert.strictEqual(window.assetColor('SOL'), '#9945ff');

  assert.match(window.assetColor('TSLA'), /^hsl\(\d+, 65%, 55%\)$/);
  assert.strictEqual(window.minSize('BTC'), 0.05);
  assert.strictEqual(window.minSize('TSLA'), 0);
});
