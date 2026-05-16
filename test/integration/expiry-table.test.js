const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

function isoDaysFromToday(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

test('Expiring This Week APR matches Open Positions APR for the same trade', (t) => {
  // dte=21, premium=150, strike=50000, size=0.05
  // annual = (150 / (50000 * 0.05)) * (365 / 21) * 100 ≈ 104.8%
  const openPut = {
    id: 1, asset: 'BTC', type: 'PUT',
    date: '2026-01-01', expiry: isoDaysFromToday(3),
    dte: 21, strike: 50000, size: 0.05, premium: 150,
    outcome: 'OPEN', closeCost: 0, platform: 'RYSK',
  };
  const { window, teardown } = setupJsdom({ trades: [openPut] });
  t.after(teardown);

  // Get APR from Open Positions table (column index 9 = APR: Asset,Platform,Date,Expiry,DTE,Type,Strike,Size,Premium,APR)
  const openCells = window.document.querySelectorAll('#ttbody-open tr td');
  const openApr = openCells[9].textContent.trim();

  // Get APR from Expiring This Week table (column index 7 = APR)
  const expRows = window.document.querySelectorAll('.expiry-tbl tbody tr td');
  const expiryApr = expRows[7].textContent.trim();

  assert.ok(openApr.length > 0, 'open positions APR should not be empty');
  assert.strictEqual(expiryApr, openApr, 'Expiring This Week APR must match Open Positions APR');
});

test('Expiring This Week respects asset filter', (t) => {
  const btcPut = {
    id: 1, asset: 'BTC', type: 'PUT',
    date: '2026-01-01', expiry: isoDaysFromToday(3),
    dte: 21, strike: 50000, size: 0.05, premium: 100,
    outcome: 'OPEN', closeCost: 0, platform: 'RYSK',
  };
  const ethPut = {
    id: 2, asset: 'ETH', type: 'PUT',
    date: '2026-01-01', expiry: isoDaysFromToday(4),
    dte: 21, strike: 3000, size: 0.5, premium: 50,
    outcome: 'OPEN', closeCost: 0, platform: 'RYSK',
  };
  const { window, teardown } = setupJsdom({ trades: [btcPut, ethPut] });
  t.after(teardown);

  // Apply ETH filter
  window.setFilter('ETH');
  window.render();

  const rows = window.document.querySelectorAll('.expiry-tbl tbody tr');
  assert.strictEqual(rows.length, 1, 'only 1 row should appear with ETH filter');
  const assetBadge = rows[0].querySelector('.badge').textContent.trim();
  assert.strictEqual(assetBadge, 'ETH', 'the remaining row should be ETH');
});
