const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

function isoDaysFromToday(days) {
  // Local-date string (not UTC) so it round-trips with `new Date(s + 'T00:00:00')`.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0').slice(0, 2);
  return yyyy + '-' + mm + '-' + dd;
}

// Find the <th> labelled `label` in the given thead element and invoke its onclick.
function clickHeader(window, theadId, label) {
  const ths = window.document.querySelectorAll('#' + theadId + ' th');
  for (const th of ths) {
    if (th.textContent.trim().startsWith(label)) {
      const m = /(\w+)\('([^']+)'\)/.exec(th.getAttribute('onclick') || '');
      if (m) window[m[1]](m[2]);
      return;
    }
  }
  throw new Error('header not found: ' + label);
}

test('Open Positions DTE column shows live countdown, not stored t.dte', (t) => {
  // Stored dte=99 is the original term at open; expiry is 3d away — live should win.
  const openPut = {
    id: 1, asset: 'BTC', type: 'PUT',
    date: '2026-01-01', expiry: isoDaysFromToday(3),
    dte: 99, strike: 50000, size: 0.05, premium: 100,
    outcome: 'OPEN', closeCost: 0, platform: 'RYSK',
  };
  const { window, teardown } = setupJsdom({ trades: [openPut] });
  t.after(teardown);

  const cells = window.document.querySelectorAll('#ttbody-open tr td');
  // Column index 4 is the DTE cell (Asset, Platform, Date, Expiry, DTE, ...).
  const dteCellText = cells[4].textContent;
  assert.ok(/\b3d\b|\b3\b/.test(dteCellText), 'expected live "3" countdown, got: ' + dteCellText);
  assert.ok(!/99/.test(dteCellText), 'should not render stored term 99 in live DTE column');
});

test('Position History column header reads "Term"; cell shows stored t.dte', (t) => {
  const settled = {
    id: 2, asset: 'BTC', type: 'PUT',
    date: '2026-01-01', expiry: '2026-01-22',
    dte: 21, strike: 50000, size: 0.05, premium: 100,
    outcome: 'EXPIRED', closeCost: 0, platform: 'RYSK',
  };
  const { window, teardown } = setupJsdom({ trades: [settled] });
  t.after(teardown);

  const histHdr = window.document.getElementById('hist-hdr');
  assert.ok(/Term/.test(histHdr.textContent), 'history header should contain "Term"');
  assert.ok(!/\bDTE\b/.test(histHdr.textContent), 'history header should not contain "DTE"');

  const cells = window.document.querySelectorAll('#ttbody-hist tr td');
  // Same column position (4) — stored 21.
  assert.strictEqual(cells[4].textContent.trim(), '21');
});

test('Open Positions DTE column sorts by expiry', (t) => {
  // Two opens: stored dte order (5, 10) is opposite to expiry order.
  // After clicking DTE, ascending order should be by expiry (soonest first).
  // All three trades share the same stored dte (20). Old behavior would tie on
  // dte and fall back to insertion order — BTC first regardless of direction.
  // New behavior sorts by expiry, so ETH (3d) or HYPE (20d) leads, never BTC.
  const trades = [
    { id: 1, asset: 'BTC',  type: 'PUT', date: '2026-01-01', expiry: isoDaysFromToday(10),
      dte: 20, strike: 50000, size: 0.05, premium: 100, outcome: 'OPEN', closeCost: 0, platform: 'RYSK' },
    { id: 2, asset: 'ETH',  type: 'PUT', date: '2026-01-01', expiry: isoDaysFromToday(3),
      dte: 20, strike: 3000, size: 0.5, premium: 50, outcome: 'OPEN', closeCost: 0, platform: 'RYSK' },
    { id: 3, asset: 'HYPE', type: 'PUT', date: '2026-01-01', expiry: isoDaysFromToday(20),
      dte: 20, strike: 20, size: 50, premium: 30, outcome: 'OPEN', closeCost: 0, platform: 'RYSK' },
  ];
  const { window, teardown } = setupJsdom({ trades });
  t.after(teardown);

  clickHeader(window, 'open-hdr', 'DTE');
  const firstA = window.document.querySelector('#ttbody-open tr td').textContent.trim();
  clickHeader(window, 'open-hdr', 'DTE');
  const firstB = window.document.querySelector('#ttbody-open tr td').textContent.trim();

  const seen = new Set([firstA, firstB]);
  assert.deepStrictEqual([...seen].sort(), ['ETH', 'HYPE'],
    'expected ETH (3d) and HYPE (20d) at the ends across two clicks; BTC must not lead');
});
