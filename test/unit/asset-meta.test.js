const test = require('node:test');
const assert = require('node:assert');

const { ASSET_BRAND, ASSET_MIN_SIZE, assetColor, minSize } = require('../../src/js/core/01b-asset-meta.js');

test('assetColor: unknown ticker gets a stable colour across calls', () => {
  const a = assetColor('TSLA');
  const b = assetColor('TSLA');
  assert.strictEqual(a, b);
  assert.match(a, /^hsl\(\d+, 65%, 55%\)$/);
});

test('assetColor: different tickers generally differ', () => {
  assert.notStrictEqual(assetColor('TSLA'), assetColor('AAPL'));
});

test('assetColor: registered brand override wins over the hash fallback', () => {
  ASSET_BRAND.BTC = '#f7931a';
  assert.strictEqual(assetColor('BTC'), '#f7931a');
  delete ASSET_BRAND.BTC;
});

test('minSize: registered ticker returns its minimum; unknown returns 0', () => {
  ASSET_MIN_SIZE.BTC = 0.05;
  assert.strictEqual(minSize('BTC'), 0.05);
  assert.strictEqual(minSize('TSLA'), 0);
  delete ASSET_MIN_SIZE.BTC;
});
