const test = require('node:test');
const assert = require('node:assert');
const { pnlCalendar } = require('../../src/js/core/07b-render-pnl-calendar.js');
const { computePnl } = require('../../src/js/core/05b-pnl.js');
// pnlCalendar reaches for a global computePnl first; provide it for Node.
global.computePnl = computePnl;
global.lotEngine = require('../../src/js/core/04b-lot-engine.js').lotEngine;

// Find the cell for a given ISO date in the built grid.
function cell(cal, iso) {
  for (const row of cal.weeks) for (const c of row) if (c.date === iso) return c;
  return null;
}

test('grid covers the month with Sun-start full weeks', () => {
  // August 2026: 1st is a Saturday, 31st is a Monday.
  const cal = pnlCalendar([], 'ALL', '2026-08');
  assert.strictEqual(cal.weeks[0][0].date, '2026-07-26', 'first cell is the Sun on/before the 1st');
  assert.strictEqual(cal.weeks[0][0].inMonth, false);
  assert.strictEqual(cell(cal, '2026-08-01').inMonth, true);
  assert.strictEqual(cell(cal, '2026-08-31').inMonth, true);
  cal.weeks.forEach(w => assert.strictEqual(w.length, 7, 'each week row holds 7 day cells (week total is separate)'));
});

test('EXPIRED option buckets realised + closed count on its expiry day', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-08-03', expiry: '2026-08-14',
      strike: 60, size: 100, premium: 226, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
  ];
  const cal = pnlCalendar(trades, 'ALL', '2026-08');
  const c = cell(cal, '2026-08-14');
  assert.strictEqual(c.realised, 226);
  assert.strictEqual(c.closed, 1);
  assert.strictEqual(cell(cal, '2026-08-03').new, 1, 'opened day gets a "new" count');
  assert.strictEqual(cal.monthTotal, 226);
});

test('CLOSED-early option buckets on closeDate, not expiry', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'CALL', date: '2026-08-01', expiry: '2026-08-28',
      strike: 65, size: 100, premium: 100, outcome: 'CLOSED', closeCost: 15, closeDate: '2026-08-11' },
  ];
  const cal = pnlCalendar(trades, 'ALL', '2026-08');
  assert.strictEqual(cell(cal, '2026-08-11').realised, 85, 'realised = 100 − 15 on the close day');
  assert.strictEqual(cell(cal, '2026-08-11').closed, 1);
  assert.strictEqual(cell(cal, '2026-08-28').realised, 0, 'nothing lands on expiry');
});

test('weekTotals and monthTotal agree with computePnl realisedByMonth', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-08-03', expiry: '2026-08-07',
      strike: 60, size: 100, premium: 100, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
    { id: 2, asset: 'IBIT', type: 'PUT', date: '2026-08-10', expiry: '2026-08-14',
      strike: 58, size: 100, premium: 50, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
  ];
  const cal = pnlCalendar(trades, 'ALL', '2026-08');
  const sumWeeks = cal.weekTotals.reduce((a, b) => a + b, 0);
  assert.strictEqual(cal.monthTotal, 150);
  assert.strictEqual(sumWeeks, 150, 'weekly totals sum to the month total');
  assert.strictEqual(computePnl(trades).realisedByMonth['2026-08'], cal.monthTotal);
});

test('asset filter scopes the calendar', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'PUT', date: '2026-08-03', expiry: '2026-08-07',
      strike: 60, size: 100, premium: 100, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
    { id: 2, asset: 'SPY', type: 'PUT', date: '2026-08-03', expiry: '2026-08-07',
      strike: 500, size: 100, premium: 40, outcome: 'EXPIRED', closeCost: 0, closeDate: '' },
  ];
  assert.strictEqual(pnlCalendar(trades, 'IBIT', '2026-08').monthTotal, 100);
  assert.strictEqual(pnlCalendar(trades, 'SPY', '2026-08').monthTotal, 40);
});

test('HOLDING trades never count as new or closed', () => {
  const trades = [
    { id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-08-05', expiry: '',
      strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, closeDate: '' },
  ];
  const cal = pnlCalendar(trades, 'ALL', '2026-08');
  assert.strictEqual(cell(cal, '2026-08-05').new, 0);
  assert.strictEqual(cal.monthTotal, 0);
});
