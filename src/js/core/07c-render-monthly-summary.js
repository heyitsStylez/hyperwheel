// ── MONTHLY SUMMARY + BENCHMARK (Wheeler) ─────────────────
// A month-scoped snapshot card: Premium Collected (+ trade count), Net P/L
// (realised for the month), and a Benchmark card showing SPY / QQQ price
// return over the same month for context alongside the portfolio's net dollars.
// Gated to Wheeler (tradfi) — see rMonthlySummary (crypto section CSS-hidden).
//
// Zero bookkeeping by design: the portfolio figure is absolute dollars, never a
// %-return (that would need an account NAV Wheeler doesn't track). The benchmark
// %s are context, not a head-to-head. SPY/QQQ stand in for S&P 500 / Nasdaq 100.
//
// monthlySummary() is pure and dual-exported for Node tests. Premium + trade
// count are bucketed by realisation date (close date for buy-to-close, else
// expiry) — the same rule computePnl uses — matching "premiums by close date".

function monthlySummary(trades, assetFilter, ym) {
  const cp = (typeof computePnl !== 'undefined')
    ? computePnl
    : require('./05b-pnl.js').computePnl;
  const { realisedByMonth } = cp(trades, assetFilter, {});

  const filtered = (assetFilter && assetFilter !== 'ALL')
    ? trades.filter(t => t.asset === assetFilter)
    : trades;

  const realDate = t => (t.outcome === 'CLOSED' && t.closeDate)
    ? t.closeDate : (t.expiry || t.date);

  let premium = 0, tradeCount = 0;
  filtered.forEach(t => {
    if (t.type === 'HOLDING' || t.outcome === 'OPEN') return;
    const d = realDate(t);
    if (!d || d.slice(0, 7) !== ym) return;
    premium += (t.premium || 0);
    tradeCount++;
  });

  return { ym, premium, tradeCount, netPnl: realisedByMonth[ym] || 0 };
}

// ── benchmark cache (localStorage) ────────────────────────
// { "SPY:2026-08": { pct, asof: "YYYY-MM-DD" } }. Past months are fixed once
// fetched; the current month is refetched when asof != today.
const MSUM_BENCH_KEY = 'wheeler_bench';
const MSUM_BENCHMARKS = [
  { sym: 'SPY', label: 'S&P 500' },
  { sym: 'QQQ', label: 'Nasdaq 100' },
];

function _benchCache() {
  try { return JSON.parse(localStorage.getItem(MSUM_BENCH_KEY) || '{}'); }
  catch (e) { return {}; }
}
function _benchGet(sym, ym) {
  const hit = _benchCache()[sym + ':' + ym];
  if (!hit) return undefined;
  const isCurrent = ym === today().slice(0, 7);
  if (isCurrent && hit.asof !== today()) return undefined; // stale current month
  return hit.pct;
}
function _benchSet(sym, ym, pct) {
  const c = _benchCache();
  c[sym + ':' + ym] = { pct, asof: today() };
  try { localStorage.setItem(MSUM_BENCH_KEY, JSON.stringify(c)); } catch (e) {}
}

// Month price return = (last close in month − last close before it) / baseline.
// Requests a short lead-in so the prior close is available as the baseline.
async function _fetchBenchPct(sym, ym) {
  const [y, m] = ym.split('-').map(Number);
  const monthStart = ym + '-01';
  const lead = new Date(Date.UTC(y, m - 1, 1));
  lead.setUTCDate(lead.getUTCDate() - 7);
  const startReq = lead.toISOString().slice(0, 10);
  const isCurrent = ym === today().slice(0, 7);
  const endReq = isCurrent ? today() : new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const r = await fetch('/api/quote?provider=twelvedata&type=timeseries&symbol=' +
    encodeURIComponent(sym) + '&start_date=' + startReq + '&end_date=' + endReq);
  if (!r.ok) throw new Error('timeseries ' + r.status);
  const d = await r.json();
  if (!d || d.status === 'error' || !Array.isArray(d.values) || !d.values.length) {
    throw new Error('no timeseries for ' + sym);
  }
  // API returns ASC (we requested order=ASC); each row { datetime, close }.
  const rows = d.values.filter(v => v && v.close).map(v => ({ dt: v.datetime, c: parseFloat(v.close) }));
  const before = rows.filter(v => v.dt < monthStart);
  const inMonth = rows.filter(v => v.dt >= monthStart);
  if (!inMonth.length) throw new Error('no in-month bars for ' + sym);
  const baseline = before.length ? before[before.length - 1].c : inMonth[0].c;
  const final = inMonth[inMonth.length - 1].c;
  if (!baseline) throw new Error('no baseline for ' + sym);
  return ((final - baseline) / baseline) * 100;
}

let _benchFetching = '';
async function _loadBenchmarks(ym) {
  if (_benchFetching === ym) return;      // in flight for this month
  _benchFetching = ym;
  let any = false;
  for (const b of MSUM_BENCHMARKS) {
    if (_benchGet(b.sym, ym) !== undefined) continue;
    try { _benchSet(b.sym, ym, await _fetchBenchPct(b.sym, ym)); any = true; }
    catch (e) { /* leave uncached; card shows — for this one */ }
  }
  _benchFetching = '';
  if (any) rMonthlySummary();
}

// Signed percent, e.g. +1.2% / −6.6%.
function _benchPct(n) {
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1) + '%';
}

function rMonthlySummary() {
  const host = document.getElementById('msum-sec');
  if (!host) return;
  if (!_isTradfi()) { host.innerHTML = ''; return; }
  if (!sSumMonth) sSumMonth = today().slice(0, 7);

  const { ym, premium, tradeCount, netPnl } = monthlySummary(trades, sFilter, sSumMonth);
  const [y, m] = ym.split('-').map(Number);
  const isCurrent = ym === today().slice(0, 7);
  const rangeLbl = isCurrent
    ? 'Month to Date'
    : CAL_MONTHS[m - 1] + ' ' + y;
  const netCls = netPnl > 0 ? 'pos' : netPnl < 0 ? 'neg' : 'zero';

  let bench = '';
  MSUM_BENCHMARKS.forEach(b => {
    const pct = _benchGet(b.sym, ym);
    const cls = pct === undefined ? 'zero' : pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'zero';
    const val = pct === undefined ? '—' : _benchPct(pct);
    bench += '<div class="msum-brow"><span class="msum-blbl">' + b.label + '</span>' +
      '<span class="msum-bval ' + cls + '">' + val + '</span></div>';
  });

  host.innerHTML =
    '<div class="cal-hd">' +
      '<div class="cal-ttl"><span class="dot dg"></span>Monthly Summary</div>' +
      '<div class="cal-nav">' +
        '<button class="cal-navbtn" onclick="setSumMonth(-1)" title="Previous month">&#8249;</button>' +
        '<span class="cal-month">' + rangeLbl + '</span>' +
        '<button class="cal-navbtn" onclick="setSumMonth(1)" title="Next month">&#8250;</button>' +
      '</div>' +
    '</div>' +
    '<div class="msum-grid">' +
      '<div class="msum-tile">' +
        '<div class="msum-lbl">Premium Collected</div>' +
        '<div class="msum-val">$' + sk(Math.round(premium)) + '</div>' +
        '<div class="msum-sub">' + tradeCount + ' trade' + (tradeCount === 1 ? '' : 's') + '</div>' +
      '</div>' +
      '<div class="msum-tile">' +
        '<div class="msum-lbl">Net P&amp;L</div>' +
        '<div class="msum-val ' + netCls + '">' + _calMoney(netPnl) + '</div>' +
        '<div class="msum-sub">realised this month</div>' +
      '</div>' +
      '<div class="msum-tile msum-bench">' +
        '<div class="msum-lbl">Benchmark (price return)</div>' +
        bench +
      '</div>' +
    '</div>';

  _loadBenchmarks(ym);
}

// Shift the displayed month by `delta` months and re-render the summary.
function setSumMonth(delta) {
  if (!sSumMonth) sSumMonth = today().slice(0, 7);
  const [y, m] = sSumMonth.split('-').map(Number);
  sSumMonth = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  rMonthlySummary();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { monthlySummary };
}
