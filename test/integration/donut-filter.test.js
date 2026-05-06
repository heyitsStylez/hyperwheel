const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

// Build a settled trade with overridable fields.
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

test('donut hidden + pills shown when < 10 settled trades', (t) => {
  const trades = makeSettledSet(5, 'EXPIRED');
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const donut = window.document.getElementById('hist-donut');
  const pills = window.document.getElementById('hist-pills');
  assert.strictEqual(donut.style.display, 'none', 'donut should be hidden');
  assert.notStrictEqual(pills.style.display, 'none', 'pills should be visible');
  assert.strictEqual(donut.querySelectorAll('.hist-donut-slice').length, 0);
});

test('donut shown + pills hidden when >= 10 settled trades', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const donut = window.document.getElementById('hist-donut');
  const pills = window.document.getElementById('hist-pills');
  assert.notStrictEqual(donut.style.display, 'none', 'donut should be visible');
  assert.strictEqual(pills.style.display, 'none', 'pills should be hidden');
  const slices = donut.querySelectorAll('.hist-donut-slice');
  assert.strictEqual(slices.length, 2, 'two outcomes → two slices');
});

test('clicking a slice filters the history table to that outcome', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const slices = window.document.querySelectorAll('#hist-donut .hist-donut-slice');
  const expiredSlice = [...slices].find(s => s.getAttribute('data-outcome') === 'EXPIRED');
  expiredSlice.dispatchEvent(new window.Event('click', { bubbles: true }));

  // ho-EXPIRED button should be marked active
  assert.ok(window.document.getElementById('ho-EXPIRED').classList.contains('active'));
  // After re-render: only EXPIRED rows in history body
  const histRows = window.document.querySelectorAll('#ttbody-hist tr');
  assert.strictEqual(histRows.length, 7);
});

test('clicking the active slice clears the filter (idempotent toggle)', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED'),
    ...makeSettledSet(3, 'CALLED'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  const getExpired = () => [...window.document.querySelectorAll('#hist-donut .hist-donut-slice')]
    .find(s => s.getAttribute('data-outcome') === 'EXPIRED');

  getExpired().dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(window.document.getElementById('ho-EXPIRED').classList.contains('active'));

  // Slice is re-rendered after first click, so re-query.
  getExpired().dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(window.document.getElementById('ho-ALL').classList.contains('active'));
  const histRows = window.document.querySelectorAll('#ttbody-hist tr');
  assert.strictEqual(histRows.length, 10, 'all 10 settled rows back in history');
});

test('asset filter chip changes the donut data', (t) => {
  const trades = [
    ...makeSettledSet(7, 'EXPIRED', 'BTC'),
    ...makeSettledSet(5, 'ASSIGNED', 'ETH'),
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  // ALL: 12 settled → donut renders, 2 outcomes.
  let slices = window.document.querySelectorAll('#hist-donut .hist-donut-slice');
  assert.strictEqual(slices.length, 2);

  // Filter to BTC → only 7 settled → below threshold → pills shown.
  window.setFilter('BTC');
  let donut = window.document.getElementById('hist-donut');
  assert.strictEqual(donut.style.display, 'none', 'BTC alone is < 10 settled');

  // Filter to ETH → only 5 settled → below threshold.
  window.setFilter('ETH');
  donut = window.document.getElementById('hist-donut');
  assert.strictEqual(donut.style.display, 'none', 'ETH alone is < 10 settled');
});
