const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

function settled(id, outcome, asset = 'BTC') {
  return {
    id,
    asset,
    type: outcome === 'CALLED' || outcome === 'CLOSED' ? 'CALL' : 'PUT',
    date: '2026-01-' + String((id % 27) + 1).padStart(2, '0'),
    expiry: '2026-02-' + String((id % 27) + 1).padStart(2, '0'),
    dte: 21,
    strike: 50000,
    size: 0.05,
    premium: 100,
    outcome,
    closeCost: 0,
    platform: 'RYSK',
  };
}

function makeSettledSet(n, outcome = 'EXPIRED', asset = 'BTC') {
  const out = [];
  for (let i = 0; i < n; i++) out.push(settled(1000 + i, outcome, asset));
  return out;
}

test('chart hidden + pills shown when < 10 settled trades', (t) => {
  const trades = makeSettledSet(5, 'EXPIRED');
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const chart = window.document.getElementById('hist-outchart');
  const pills = window.document.getElementById('hist-pills');
  assert.strictEqual(chart.style.display, 'none', 'chart should be hidden');
  assert.notStrictEqual(pills.style.display, 'none', 'pills should be visible');
  assert.strictEqual(chart.querySelectorAll('.outchart-cell').length, 0);
});

test('chart shown + pills hidden when >= 10 settled trades', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const chart = window.document.getElementById('hist-outchart');
  const pills = window.document.getElementById('hist-pills');
  assert.notStrictEqual(chart.style.display, 'none', 'chart should be visible');
  assert.strictEqual(pills.style.display, 'none', 'pills should be hidden');
  const cells = chart.querySelectorAll('.outchart-cell');
  assert.strictEqual(cells.length, 2, 'two outcomes → two cells');
});

test('clicking a cell filters the history table to that outcome', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const cells = window.document.querySelectorAll('#hist-outchart .outchart-cell');
  const expiredCell = [...cells].find(c => c.getAttribute('data-outcome') === 'EXPIRED');
  expiredCell.dispatchEvent(new window.Event('click', { bubbles: true }));

  assert.ok(window.document.getElementById('ho-EXPIRED').classList.contains('active'));
  const histRows = window.document.querySelectorAll('#ttbody-hist tr');
  assert.strictEqual(histRows.length, 7);
});

test('clicking the active cell clears the filter (idempotent toggle)', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const getExpired = () => [...window.document.querySelectorAll('#hist-outchart .outchart-cell')]
    .find(c => c.getAttribute('data-outcome') === 'EXPIRED');

  getExpired().dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(window.document.getElementById('ho-EXPIRED').classList.contains('active'));

  getExpired().dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(window.document.getElementById('ho-ALL').classList.contains('active'));
  const histRows = window.document.querySelectorAll('#ttbody-hist tr');
  assert.strictEqual(histRows.length, 10, 'all 10 settled rows back in history');
});

test('asset filter chip changes the chart data', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED', 'BTC'),
    ...makeSettledSet(5, 'ASSIGNED', 'ETH'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  let cells = window.document.querySelectorAll('#hist-outchart .outchart-cell');
  assert.strictEqual(cells.length, 2);

  window.setFilter('BTC');
  let chart = window.document.getElementById('hist-outchart');
  assert.strictEqual(chart.style.display, 'none', 'BTC alone is < 10 settled');

  window.setFilter('ETH');
  chart = window.document.getElementById('hist-outchart');
  assert.strictEqual(chart.style.display, 'none', 'ETH alone is < 10 settled');
});
