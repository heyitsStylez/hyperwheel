const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

const HOLDING_ETH = {
  id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
  dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
  closeCost: 0, platform: 'SPOT',
};
const PUT_ETH_EXPIRED = {
  id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
  dte: 14, strike: 2800, size: 1, premium: 100, outcome: 'EXPIRED',
  closeCost: 0, platform: 'RYSK',
};
const HOLDING_BTC = {
  id: 3, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
  dte: null, strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN',
  closeCost: 0, platform: 'SPOT',
};

test('hero band contains a Total P&L tile in the header row', (t) => {
  const { window, teardown } = setupJsdom({ trades: [HOLDING_ETH] });
  t.after(teardown);

  const tile = window.document.getElementById('cpnl-tile');
  assert.ok(tile, '#cpnl-tile should exist in the hero band');

  const hero = window.document.getElementById('cpnl-hero');
  assert.ok(hero.contains(tile), 'tile must live inside the hero band');
});

test('hero tile Total = Realised + Unrealised', (t) => {
  // PUT EXPIRED netPrem 100 + HOLDING ETH 3000 size 1 spot 3500 → total = 600.
  const { window, teardown } = setupJsdom({ trades: [PUT_ETH_EXPIRED, HOLDING_ETH] });
  t.after(teardown);

  window.livePrices = { ETH: 3500 };
  window.render();

  const total = window.document.getElementById('cpnl-tile-total').textContent;
  assert.match(total, /\+\$600/, `expected +$600 in hero Total, got "${total}"`);

  const unrealised = window.document.getElementById('cpnl-tile-unrealised').textContent;
  assert.match(unrealised, /\+\$500/, `expected +$500 Unrealised, got "${unrealised}"`);
});

test('hero tile respects asset filter', (t) => {
  const { window, teardown } = setupJsdom({ trades: [HOLDING_BTC, HOLDING_ETH] });
  t.after(teardown);

  window.livePrices = { BTC: 52000, ETH: 3500 };
  window.setFilter('BTC');

  // BTC: (52000-50000)*0.1 = 200
  const total = window.document.getElementById('cpnl-tile-total').textContent;
  const unrealised = window.document.getElementById('cpnl-tile-unrealised').textContent;
  assert.match(unrealised, /\+\$200/, `BTC-only Unrealised should be +$200, got "${unrealised}"`);
  assert.match(total, /\+\$200/, `BTC-only Total should be +$200, got "${total}"`);
});

test('hero tile partial missing-spot: renders partial Total + sub-line, no asterisk', (t) => {
  const { window, teardown } = setupJsdom({ trades: [HOLDING_ETH, HOLDING_BTC] });
  t.after(teardown);

  window.livePrices = { ETH: 3500 }; // BTC missing
  window.render();

  const total = window.document.getElementById('cpnl-tile-total').textContent;
  const sub = window.document.getElementById('cpnl-tile-sub').textContent;
  // Partial = ETH unrealised only = 500
  assert.match(total, /\+\$500/, `expected +$500 partial Total, got "${total}"`);
  assert.match(sub, /BTC/, `sub-line should call out BTC, got "${sub}"`);
  const tile = window.document.getElementById('cpnl-tile');
  assert.ok(!tile.textContent.includes('*'),
    `tile must not contain an asterisk under partial state, got "${tile.textContent}"`);
});

test('hero tile full missing-spot: dashes + sub-line; Realised stays visible', (t) => {
  const { window, teardown } = setupJsdom({ trades: [HOLDING_ETH, PUT_ETH_EXPIRED] });
  t.after(teardown);

  // livePrices stays {} → ETH spot missing for the only open lot.
  const total = window.document.getElementById('cpnl-tile-total').textContent;
  const unrealised = window.document.getElementById('cpnl-tile-unrealised').textContent;
  const sub = window.document.getElementById('cpnl-tile-sub').textContent;
  assert.match(unrealised, /^—|^-$/, `expected dash Unrealised, got "${unrealised}"`);
  assert.match(total, /^—|^-$/, `expected dash Total, got "${total}"`);
  assert.match(sub, /spot unavailable/i, `sub-line should say spot unavailable, got "${sub}"`);

  // Realised line header (#cpnl-val) still shows the +$100 from the EXPIRED PUT.
  const heroVal = window.document.getElementById('cpnl-val').textContent;
  assert.match(heroVal, /\+\$100/, `Realised hero number should still render, got "${heroVal}"`);

  const tile = window.document.getElementById('cpnl-tile');
  assert.ok(!tile.textContent.includes('*'),
    `tile must not contain an asterisk under full-miss state, got "${tile.textContent}"`);
});
