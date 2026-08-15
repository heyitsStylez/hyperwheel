// ── P&L CALENDAR (Wheeler) ────────────────────────────────
// A monthly heatmap of realised P&L: each day cell shows net realised P&L plus
// an activity line ("N closed · N new"), a per-week total column, month total and
// prev/next month navigation. Gated to Wheeler (tradfi) — see rPnlCalendar.
//
// Realised P&L is dated on the realisation day (close date for buy-to-close, else
// expiry) — the same rule computePnl uses, sourced from its realisedByDay map.
// "New" counts option positions opened that day (bucketed on their open `date`).
//
// pnlCalendar() is pure and dual-exported for Node tests.

const CAL_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// Build the Sun–Sat grid for `ym` ('YYYY-MM') with per-day realised + counts,
// weekly totals and a month total. Cells outside the month carry no stats.
function pnlCalendar(trades, assetFilter, ym) {
  const cp = (typeof computePnl !== 'undefined')
    ? computePnl
    : require('./05b-pnl.js').computePnl;
  const { realisedByDay } = cp(trades, assetFilter, {});

  const filtered = (assetFilter && assetFilter !== 'ALL')
    ? trades.filter(t => t.asset === assetFilter)
    : trades;

  // Mirrors the realisation-date rule in 05b-pnl.js.
  const realDate = t => (t.outcome === 'CLOSED' && t.closeDate)
    ? t.closeDate : (t.expiry || t.date);

  const closed = {}, opened = {};
  filtered.forEach(t => {
    if (t.type === 'HOLDING') return;
    if (t.date && t.date.slice(0, 7) === ym) opened[t.date] = (opened[t.date] || 0) + 1;
    if (t.outcome && t.outcome !== 'OPEN') {
      const d = realDate(t);
      if (d && d.slice(0, 7) === ym) closed[d] = (closed[d] || 0) + 1;
    }
  });

  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();  // 0=Sun

  const cur = new Date(Date.UTC(y, m - 1, 1 - startDow));
  const weeks = [], weekTotals = [];
  let monthTotal = 0;
  // Enough rows to cover the whole month, padded to full Sun–Sat weeks.
  const rows = Math.ceil((startDow + daysInMonth) / 7);
  for (let w = 0; w < rows; w++) {
    const row = [];
    let wt = 0;
    for (let i = 0; i < 7; i++) {
      const iso = cur.toISOString().slice(0, 10);
      const inMonth = iso.slice(0, 7) === ym;
      const cell = { date: iso, inMonth };
      if (inMonth) {
        const r = realisedByDay[iso] || 0;
        cell.realised = r;
        cell.closed = closed[iso] || 0;
        cell.new = opened[iso] || 0;
        wt += r;
        monthTotal += r;
      }
      row.push(cell);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(row);
    weekTotals.push(wt);
  }
  return { ym, weeks, weekTotals, monthTotal };
}

// Signed money label, e.g. +$1,046 / −$62. Whole dollars (calendar cells).
function _calMoney(n) {
  const sign = n < 0 ? '−' : '+';
  return sign + '$' + sk(Math.abs(Math.round(n)));
}

function rPnlCalendar() {
  const host = document.getElementById('pnl-cal-sec');
  if (!host) return;
  if (!_isTradfi()) { host.innerHTML = ''; return; }
  if (!sCalMonth) sCalMonth = today().slice(0, 7);

  const { ym, weeks, weekTotals, monthTotal } = pnlCalendar(trades, sFilter, sCalMonth);
  const [y, m] = ym.split('-').map(Number);
  const todayIso = today();
  const totCls = monthTotal > 0 ? 'pos' : monthTotal < 0 ? 'neg' : 'zero';

  let html =
    '<div class="cal-hd">' +
      '<div class="cal-ttl"><span class="dot dg"></span>P&amp;L Calendar</div>' +
      '<div class="cal-nav">' +
        '<span class="cal-total ' + totCls + '">' + _calMoney(monthTotal) + '</span>' +
        '<button class="cal-navbtn" onclick="setCalMonth(-1)" title="Previous month">&#8249;</button>' +
        '<span class="cal-month">' + CAL_MONTHS[m - 1] + ' ' + y + '</span>' +
        '<button class="cal-navbtn" onclick="setCalMonth(1)" title="Next month">&#8250;</button>' +
      '</div>' +
    '</div>';

  html += '<div class="cal-grid">';
  ['SUN','MON','TUE','WED','THU','FRI','SAT','WEEK'].forEach(d =>
    html += '<div class="cal-dow' + (d === 'WEEK' ? ' cal-dow-wk' : '') + '">' + d + '</div>');

  weeks.forEach((row, wi) => {
    row.forEach(cell => {
      if (!cell.inMonth) { html += '<div class="cal-cell cal-out"></div>'; return; }
      const dayNum = +cell.date.slice(8, 10);
      const has = cell.realised !== 0 || cell.closed > 0 || cell.new > 0;
      const cls = cell.realised > 0 ? 'pos' : cell.realised < 0 ? 'neg' : '';
      const isToday = cell.date === todayIso;
      let inner = '<div class="cal-daynum">' + dayNum + '</div>';
      if (cell.realised !== 0)
        inner += '<div class="cal-pnl ' + cls + '">' + _calMoney(cell.realised) + '</div>';
      const bits = [];
      if (cell.closed > 0) bits.push(cell.closed + ' closed');
      if (cell.new > 0) bits.push(cell.new + ' new');
      if (bits.length) inner += '<div class="cal-act">' + bits.join(' · ') + '</div>';
      html += '<div class="cal-cell ' + (has ? cls : '') + (isToday ? ' cal-today' : '') + '">' + inner + '</div>';
    });
    const wt = weekTotals[wi];
    const wcls = wt > 0 ? 'pos' : wt < 0 ? 'neg' : 'zero';
    html += '<div class="cal-cell cal-week ' + wcls + '">' +
      (wt !== 0 ? '<div class="cal-pnl ' + wcls + '">' + _calMoney(wt) + '</div>' : '') +
      '</div>';
  });
  html += '</div>';

  host.innerHTML = html;
}

// Shift the displayed month by `delta` months and re-render just the calendar.
function setCalMonth(delta) {
  if (!sCalMonth) sCalMonth = today().slice(0, 7);
  const [y, m] = sCalMonth.split('-').map(Number);
  sCalMonth = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  rPnlCalendar();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pnlCalendar };
}
