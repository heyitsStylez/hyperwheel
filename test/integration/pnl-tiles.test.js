const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Find a P&L card by its label text.
function findCard(window, labelRegex) {
  const cards = window.document.querySelectorAll('.ppnl-card');
  for (const c of cards) {
    const lbl = c.querySelector('.ppnl-lbl');
    if (lbl && labelRegex.test(lbl.textContent)) return c;
  }
  return null;
}
function findRealisedCard(window) { return findCard(window, /Realised P&L/i); }
function findUnrealisedCard(window) { return findCard(window, /Unrealised P&L/i); }
function findTotalCard(window) { return findCard(window, /^Total P&L/i); }

function assertHasTooltip(card, tipPattern) {
  const tip = card.getAttribute('data-tip') || '';
  if (!tipPattern.test(tip)) {
    throw new Error('expected data-tip to match ' + tipPattern + ', got "' + tip + '"');
  }
  const lbl = card.querySelector('.ppnl-lbl');
  const ico = lbl && lbl.querySelector('.ppnl-tip-ico');
  if (!ico) throw new Error('expected ⓘ glyph (.ppnl-tip-ico) inside .ppnl-lbl');
}

test('Total Premium Collected tile has tooltip + ⓘ glyph', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const card = findCard(window, /Total Premium Collected/i);
  assert.ok(card, 'Total Premium Collected card should exist');
  assertHasTooltip(card, /premium/i);
});

test('Total Notional tile has tooltip + ⓘ glyph', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);
  assertHasTooltip(findCard(window, /Total Notional/i), /notional|strike.*size/i);
});

test('Portfolio APR tile has tooltip + ⓘ glyph', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);
  assertHasTooltip(findCard(window, /Portfolio APR/i), /APR|annualised|annualized/i);
});

test('Return Rate tile has tooltip + ⓘ glyph', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);
  assertHasTooltip(findCard(window, /Return Rate/i), /OTM|expired/i);
});

test('Realised P&L tile renders settled premium total', (t) => {
  const trades = [
    // BTC PUT expired → +120
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
    // ETH PUT expired → +80
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 3000, size: 1, premium: 80, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // Default sFilter is 'ALL' — both assets contribute.
  const card = findRealisedCard(window);
  assert.ok(card, 'Realised P&L card should exist on Total tab');

  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$200/, `expected +$200, got "${main}"`);

  // Styled popover present; native title= dropped (it produced a duplicate
  // slow browser tooltip on top of the styled one).
  assert.match(card.getAttribute('data-tip') || '', /Realised P&L/);
  assert.strictEqual(card.getAttribute('title'), null);
});

test('Realised P&L tile respects asset filter (sFilter)', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 3000, size: 1, premium: 80, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.setFilter('BTC');

  const card = findRealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$120/, `under BTC filter expected +$120, got "${main}"`);
});

test('Hero band has no duplicate Realised sparkline (#npnl-* removed)', (t) => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      dte: 14, strike: 3500, size: 1, premium: 50, outcome: 'CALLED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  assert.strictEqual(window.document.getElementById('npnl-val'), null,
    '#npnl-val (duplicate sparkline header) should be removed');
  assert.strictEqual(window.document.getElementById('npnl-chart-area'), null,
    '#npnl-chart-area (duplicate sparkline canvas host) should be removed');
  assert.strictEqual(window.document.getElementById('npnl-canvas'), null,
    '#npnl-canvas (duplicate sparkline canvas) should be removed');
  assert.strictEqual(window.document.querySelector('.npnl-spark'), null,
    '.npnl-spark wrapper should be removed');
});

test('Cumulative-hero sparkline header shows Realised P&L (premium + capital gain)', (t) => {
  // HOLDING + CALLED → realised = 50 + 500 = 550. Hero header (#cpnl-val) should
  // show +$550, proving capital gain feeds the cumulative series (not premium-only).
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      dte: 14, strike: 3500, size: 1, premium: 50, outcome: 'CALLED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const heroVal = window.document.getElementById('cpnl-val');
  assert.ok(heroVal, '#cpnl-val should exist');
  assert.match(heroVal.textContent, /\+\$550/, `expected +$550 in cumulative hero, got "${heroVal.textContent}"`);
});

test('CALL CALLED on HOLDING lot contributes capital gain to Realised tile', (t) => {
  // HOLDING ETH at 3000 size 1, then CALL at 3500 size 1 premium 50, called.
  // Realised = 50 + (3500-3000)*1 = 550
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      dte: 14, strike: 3500, size: 1, premium: 50, outcome: 'CALLED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // Default sFilter='ALL' — single-asset trade set sums to expected total.
  const card = findRealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$550/, `expected +$550, got "${main}"`);
});

test('Unrealised P&L tile marks open lots to market against costBasis', (t) => {
  // HOLDING ETH at 3000 size 1, spot 3500 → unrealised = 500.
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.livePrices = { ETH: 3500 };
  window.render();

  const card = findUnrealisedCard(window);
  assert.ok(card, 'Unrealised P&L card should exist');
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$500/, `expected +$500, got "${main}"`);
  assert.match(card.getAttribute('data-tip') || '', /Unrealised P&L/);
  assert.strictEqual(card.getAttribute('title'), null);
});

test('Total P&L tile = Realised + Unrealised', (t) => {
  // PUT EXPIRED netPrem 100 + HOLDING ETH 3000 size 1 spot 3500 → total = 100 + 500 = 600.
  const trades = [
    { id: 1, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 2800, size: 1, premium: 100, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
    { id: 2, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.livePrices = { ETH: 3500 };
  window.render();

  const card = findTotalCard(window);
  assert.ok(card, 'Total P&L card should exist');
  const main = card.querySelector('.ppnl-main').textContent;
  assert.match(main, /\+\$600/, `expected +$600, got "${main}"`);
  assert.match(card.getAttribute('data-tip') || '', /Total P&L/);
  assert.strictEqual(card.getAttribute('title'), null);
});

test('Unrealised tile shows dash + spot-unavailable sub-line when spot missing', (t) => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // livePrices stays {} (fetchExpiryPrices stubbed, never resolves).
  const card = findUnrealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  const sub = card.querySelector('.ppnl-sub').textContent;
  assert.match(main, /—|&mdash;|-/, `expected dash main, got "${main}"`);
  assert.match(sub, /spot unavailable.*ETH/i, `expected spot-unavailable sub, got "${sub}"`);
});

test('Unrealised tile partial: sums available, sub-line lists missing', (t) => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.livePrices = { ETH: 3500 }; // BTC missing
  window.render();

  const card = findUnrealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  const sub = card.querySelector('.ppnl-sub').textContent;
  assert.match(main, /\+\$500/, `expected +$500 (ETH only), got "${main}"`);
  assert.match(sub, /BTC/, `expected BTC in sub-line, got "${sub}"`);
});

test('Unrealised + Total tiles respect asset filter', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.livePrices = { BTC: 52000, ETH: 3500 };
  window.setFilter('BTC');

  const card = findUnrealisedCard(window);
  const main = card.querySelector('.ppnl-main').textContent;
  // BTC: (52000-50000)*0.1 = 200
  assert.match(main, /\+\$200/, `under BTC filter expected +$200, got "${main}"`);
});

test('Holdings card Net Cost hero has tooltip + ⓘ glyph (lens disambiguation)', (t) => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // The Net Cost hero block — find by its label.
  const heros = window.document.querySelectorAll('.hcard-hero');
  let hero = null;
  for (const h of heros) {
    const lbl = h.querySelector('.hcard-hero-lbl');
    if (lbl && /Net Cost/i.test(lbl.textContent)) { hero = h; break; }
  }
  assert.ok(hero, 'expected Net Cost hero block on the holdings card');

  // Popover wired via the same data-tip + has-tip pattern as the PnL tiles,
  // explaining the lens difference vs Unrealised P&L.
  assert.ok(hero.classList.contains('has-tip'), 'hero should opt into has-tip styling');
  const tip = hero.getAttribute('data-tip') || '';
  assert.match(tip, /Unrealised|mark-to-market/i,
    'tooltip should disambiguate Net Cost lens from Unrealised P&L lens');
  // ⓘ glyph rendered inside the label, matching the PnL-tile affordance.
  const ico = hero.querySelector('.tip-ico, .ppnl-tip-ico');
  assert.ok(ico, 'expected ⓘ glyph next to the Net Cost label');
});

test('Monthly tab header reads "Realised P&L" (renamed from Net P&L)', (t) => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      dte: 14, strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.setPpnlTab('monthly');

  const headers = Array.from(window.document.querySelectorAll('.ppnl-mtbl thead th'))
    .map(th => th.textContent.trim());
  assert.ok(headers.some(h => /Realised P&L/i.test(h)),
    `expected "Realised P&L" header, got ${JSON.stringify(headers)}`);
  assert.ok(!headers.some(h => /^Net P&L$/i.test(h)),
    `"Net P&L" header should be gone, got ${JSON.stringify(headers)}`);
});

test('Monthly tab Realised value comes from computePnl (HOLDING + CALLED → premium + cap gain)', (t) => {
  // HOLDING ETH at 3000 size 1 (Jan), then CALL at 3500 size 1 premium 50, called Feb.
  // Cash-flow Realised for Feb = 50 + (3500-3000)*1 = 550. Old netPnl formula would
  // include +call-away notional ($3500), giving a very different number.
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      dte: null, strike: 3000, size: 1, premium: 0, outcome: 'OPEN',
      closeCost: 0, platform: 'SPOT' },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-02-01', expiry: '2026-02-15',
      dte: 14, strike: 3500, size: 1, premium: 50, outcome: 'CALLED',
      closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  window.setPpnlTab('monthly');

  // Find the Feb row by month label.
  const rows = Array.from(window.document.querySelectorAll('.ppnl-mtbl tbody tr'));
  const febRow = rows.find(r => /Feb/i.test(r.children[0].textContent));
  assert.ok(febRow, 'expected a Feb row in the monthly table');

  // Realised P&L is the 3rd column (Month | Premium | Realised P&L | APR | Rate).
  const realisedCell = febRow.children[2].textContent;
  assert.match(realisedCell, /\+\$550/,
    `expected +$550 (cash-flow Realised) in Feb row, got "${realisedCell}"`);
});

test('Holdings card does not clip its tooltip popover (no overflow:hidden on .hcard)', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'css', 'styles.css'), 'utf8');
  // Match the .hcard rule (not .hcard-foo) and check it doesn't set overflow:hidden,
  // which would clip the .has-tip popover anchored to the .hcard-hero inside.
  const m = css.match(/\.hcard\s*\{([^}]*)\}/);
  assert.ok(m, '.hcard rule should exist');
  assert.doesNotMatch(m[1], /overflow\s*:\s*hidden/i,
    '.hcard must not set overflow:hidden — would clip Net Cost tooltip');
});
