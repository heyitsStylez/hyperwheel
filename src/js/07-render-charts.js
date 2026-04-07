// ── CUMULATIVE P&L HERO CHART
function setCpnlPeriod(p) {
  sCpnlPeriod = p;
  ['1M','3M','ALL'].forEach(x => {
    const b = document.getElementById('cpnl-btn-' + x);
    if (b) b.classList.toggle('active', x === p);
  });
  rCpnlChart();
}

function rCpnlChart() {
  const area = document.getElementById('cpnl-chart-area');
  if (!area) return;

  // Build time series from all non-HOLDING trades
  // OPEN trades: book premium at open date (already collected)
  // Settled trades: book at expiry date
  const events = [];
  trades.forEach(t => {
    if (t.type === 'HOLDING') return;
    const eventDate = t.outcome === 'OPEN' ? t.date : t.expiry;
    if (!eventDate) return;
    const prem = (t.premium || 0) - (t.closeCost || 0);
    events.push({ date: eventDate, prem });
  });
  events.sort((a, b) => a.date.localeCompare(b.date));

  if (!events.length) {
    area.innerHTML = '<div class="cpnl-empty"><span style="font-size:1.6rem;opacity:.3">&#9196;</span>No trades yet</div>';
    const vEl = document.getElementById('cpnl-val');
    if (vEl) vEl.textContent = '—';
    const cEl = document.getElementById('cpnl-change');
    if (cEl) cEl.innerHTML = '';
    return;
  }

  // Period filter cutoff
  const today = new Date();
  let cutoff = null;
  if (sCpnlPeriod === '1M') {
    cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
  } else if (sCpnlPeriod === '3M') {
    cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
  }

  // Build cumulative series for ALL time first (for total shown in header)
  let runAll = 0;
  const allSeries = [{ date: events[0].date, val: 0 }];
  events.forEach(e => {
    runAll += e.prem;
    const last = allSeries[allSeries.length - 1];
    if (last.date === e.date) { last.val = runAll; }
    else { allSeries.push({ date: e.date, val: runAll }); }
  });
  const totalPnl = runAll;

  // Filter series for display period
  let dispSeries;
  if (!cutoff) {
    dispSeries = allSeries;
  } else {
    const cutStr = cutoff.toISOString().slice(0, 10);
    // find the baseline value just before the cutoff
    let baseline = 0;
    let lastBefore = allSeries.filter(p => p.date < cutStr);
    if (lastBefore.length) baseline = lastBefore[lastBefore.length - 1].val;
    const inPeriod = allSeries.filter(p => p.date >= cutStr);
    if (!inPeriod.length) {
      // no events in period — show flat line at current total
      dispSeries = [{ date: cutStr, val: totalPnl }, { date: today.toISOString().slice(0, 10), val: totalPnl }];
    } else {
      // prepend anchor at cutoff start
      dispSeries = [{ date: cutStr, val: baseline }, ...inPeriod];
    }
  }

  // Add today as the final point (carries last value forward)
  const todayStr = today.toISOString().slice(0, 10);
  const last = dispSeries[dispSeries.length - 1];
  if (last.date < todayStr) {
    dispSeries = [...dispSeries, { date: todayStr, val: last.val }];
  }

  // Period change
  const periodStart = dispSeries[0].val;
  const periodEnd = dispSeries[dispSeries.length - 1].val;
  const periodChange = periodEnd - periodStart;

  // Update header val
  const vEl = document.getElementById('cpnl-val');
  if (vEl) {
    vEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + fmt(Math.abs(totalPnl));
    vEl.className = 'cpnl-hero-val' + (totalPnl < 0 ? ' neg' : '');
  }
  const cEl = document.getElementById('cpnl-change');
  if (cEl) {
    if (sCpnlPeriod !== 'ALL' && periodChange !== 0) {
      const sign = periodChange >= 0 ? '+' : '';
      const cls = periodChange >= 0 ? 'chg-pos' : 'chg-neg';
      cEl.innerHTML = '<span class="' + cls + '">' + sign + '$' + fmt(Math.abs(periodChange)) + '</span> this period';
    } else {
      const trades_count = events.length;
      cEl.innerHTML = trades_count + ' trade' + (trades_count !== 1 ? 's' : '');
    }
  }

  // Render canvas
  const DPR = window.devicePixelRatio || 1;
  const W = area.clientWidth || 800;
  const H = 186;

  area.innerHTML = '<div class="cpnl-canvas-wrap"><canvas id="cpnl-canvas"></canvas><div class="cpnl-dot" id="cpnl-dot" style="display:none"></div></div>';
  const canvas = document.getElementById('cpnl-canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const cs = getComputedStyle(document.documentElement);
  const greenColor = cs.getPropertyValue('--green').trim() || '#00e5a0';
  const redColor   = cs.getPropertyValue('--red').trim()   || '#f05050';
  const muColor    = cs.getPropertyValue('--mu').trim()    || '#5a6680';
  const bdColor    = cs.getPropertyValue('--bd').trim()    || '#1c2538';

  const pad = { top: 14, right: 24, bottom: 36, left: 56 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const vals = dispSeries.map(p => p.val);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const spread = maxV - minV || 1;

  const dates = dispSeries.map(p => new Date(p.date + 'T12:00:00').getTime());
  const minD = dates[0], maxD = dates[dates.length - 1];
  const dateSpan = maxD - minD || 1;

  function toX(d) { return pad.left + ((d - minD) / dateSpan) * cW; }
  function toY(v) { return pad.top + (1 - (v - minV) / spread) * cH; }

  const pts = dispSeries.map((p, i) => ({ x: toX(dates[i]), y: toY(p.val) }));
  const zeroY = toY(0);
  const lineColor = periodEnd >= periodStart ? greenColor : redColor;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, lineColor.replace(')', ', 0.25)').replace('rgb(', 'rgba(').replace(/^(#[0-9a-f]{6})$/i, (h) => {
    const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',0.25)';
  }));
  grad.addColorStop(1, lineColor.replace(')', ', 0)').replace('rgb(', 'rgba(').replace(/^(#[0-9a-f]{6})$/i, (h) => {
    const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',0)';
  }));

  // Helper: parse any color to rgba string
  function toRgba(color, alpha) {
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const r = parseInt(hex[1].slice(0,2),16);
      const g = parseInt(hex[1].slice(2,4),16);
      const b = parseInt(hex[1].slice(4,6),16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    const rgb = color.match(/rgba?\(([^)]+)\)/);
    if (rgb) {
      const parts = rgb[1].split(',').slice(0,3);
      return 'rgba(' + parts.join(',') + ',' + alpha + ')';
    }
    return color;
  }
  const gradFill = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  gradFill.addColorStop(0, toRgba(lineColor, 0.22));
  gradFill.addColorStop(0.7, toRgba(lineColor, 0.06));
  gradFill.addColorStop(1, toRgba(lineColor, 0));

  // Draw zero line
  ctx.save();
  ctx.strokeStyle = bdColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(pad.left + cW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Smooth Bézier path using Catmull-Rom spline
  function buildPath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) return;
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  // Fill area
  ctx.save();
  buildPath(pts);
  ctx.lineTo(pts[pts.length - 1].x, Math.min(zeroY, pad.top + cH));
  ctx.lineTo(pts[0].x, Math.min(zeroY, pad.top + cH));
  ctx.closePath();
  ctx.fillStyle = gradFill;
  ctx.fill();
  ctx.restore();

  // Stroke line
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  buildPath(pts);
  ctx.stroke();
  ctx.restore();

  // Y-axis labels
  ctx.save();
  ctx.fillStyle = muColor;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  const yTicks = 3;
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (spread * i / yTicks);
    const y = toY(v);
    const label = (v >= 0 ? '' : '-') + '$' + (Math.abs(v) >= 1000 ? (Math.abs(v)/1000).toFixed(1)+'k' : Math.abs(v).toFixed(0));
    ctx.fillText(label, pad.left - 6, y + 3.5);
  }
  ctx.restore();

  // X-axis date labels
  ctx.save();
  ctx.fillStyle = muColor;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const MTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const xTicks = Math.min(5, dispSeries.length);
  const step = Math.floor((dispSeries.length - 1) / Math.max(1, xTicks - 1));
  const shownX = new Set();
  for (let i = 0; i < dispSeries.length; i += Math.max(1, step)) {
    const d = new Date(dispSeries[i].date + 'T12:00:00');
    const lbl = MTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
    const x = toX(dates[i]);
    if (!shownX.has(lbl)) {
      shownX.add(lbl);
      ctx.fillText(lbl, x, pad.top + cH + 22);
    }
  }
  ctx.restore();

  // Animated end dot — position via CSS overlay
  const lastPt = pts[pts.length - 1];
  const dotEl = document.getElementById('cpnl-dot');
  if (dotEl && lastPt) {
    dotEl.style.display = 'block';
    dotEl.style.left = lastPt.x + 'px';
    dotEl.style.top = lastPt.y + 'px';
    dotEl.style.color = lineColor;
  }
}

function rCharts(displayRows) {
  rCpnlChart();
  const el = document.getElementById('ppnl-body');
  if (!el) return;

  function calcStats(rows) {
    let totalPrem = 0, totalCount = 0;
    let otmPrem = 0, otmCount = 0;
    let itmPrem = 0, itmCount = 0;
    let assignedNotional = 0;
    rows.forEach(r => {
      if (r.type === 'HOLDING') return;
      const net = (r.premium || 0) - (r.closeCost || 0);
      totalPrem += net;
      totalCount++;
      if (r.outcome === 'OPEN') return; // premium collected but not yet settled — skip OTM/ITM buckets
      if (r.outcome === 'EXPIRED') {
        otmPrem += net;
        otmCount++;
      } else if (r.outcome === 'ASSIGNED' || r.outcome === 'CALLED') {
        itmPrem += net;
        itmCount++;
        if (r.outcome === 'ASSIGNED') assignedNotional += (r.strike || 0) * (r.size || 0);
      }
    });
    const settled = otmCount + itmCount;
    const returnRate = settled > 0 ? otmCount / settled * 100 : null;
    return { totalPrem, totalCount, otmPrem, otmCount, itmPrem, itmCount, assignedNotional, returnRate, settled };
  }

  const pos = n => n === 1 ? '1 position' : n + ' positions';
  const asgn = n => n === 1 ? '1 assignment' : n + ' assignments';
  const dash = '&mdash;';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtMonth(ym) {
    const [y, m] = ym.split('-');
    return MONTHS[+m - 1] + " '" + y.slice(2);
  }

  if (sPpnlTab === 'total') {
    const s = calcStats(displayRows);
    function card(label, main, sub) {
      return '<div class="ppnl-card">' +
        '<div class="ppnl-lbl">' + label + '</div>' +
        '<div class="ppnl-main">' + main + '</div>' +
        (sub ? '<div class="ppnl-sub">' + sub + '</div>' : '') +
      '</div>';
    }
    el.className = 'ppnl-cards';
    el.innerHTML = [
      card('Total Premium Collected',
        s.totalCount > 0 ? '$' + fmt(s.totalPrem) : dash,
        s.totalCount > 0 ? pos(s.totalCount) : ''),
      card('Premium Expired OTM',
        s.otmCount > 0 ? '$' + fmt(s.otmPrem) : dash,
        s.otmCount > 0 ? pos(s.otmCount) : ''),
      card('Premium Expired ITM',
        s.itmCount > 0 ? '$' + fmt(s.itmPrem) : dash,
        s.itmCount > 0 ? pos(s.itmCount) : ''),
      card('Return Rate',
        s.returnRate !== null ? s.returnRate.toFixed(1) + '%' : dash,
        s.settled > 0 ? s.otmCount + ' / ' + s.settled + ' exp OTM' : ''),
      card('Assigned Notional',
        s.assignedNotional > 0 ? '$' + fmt(s.assignedNotional) : dash,
        s.itmCount > 0 ? asgn(s.itmCount) : ''),
    ].join('');

  } else {
    // Group trades by month — OPEN trades by open date, settled by expiry date
    const monthMap = {};
    displayRows.forEach(r => {
      if (r.type === 'HOLDING') return;
      const dateKey = r.outcome === 'OPEN' ? r.date : r.expiry;
      if (!dateKey) return;
      const ym = dateKey.slice(0, 7);
      if (!monthMap[ym]) monthMap[ym] = [];
      monthMap[ym].push(r);
    });
    const months = Object.keys(monthMap).sort().reverse();

    el.className = 'ppnl-mtbl-wrap';
    if (!months.length) {
      el.innerHTML = '<div class="empty" style="padding:32px"><div class="eico">&#128200;</div><p>No settled trades yet</p></div>';
      return;
    }

    const rows = months.map(ym => {
      const s = calcStats(monthMap[ym]);
      const rateClass = s.returnRate === null ? '' : s.returnRate >= 70 ? ' class="rate-hi"' : s.returnRate < 50 ? ' class="rate-lo"' : '';
      return '<tr>' +
        '<td>' + fmtMonth(ym) + '</td>' +
        '<td>' + (s.totalCount > 0 ? '$' + fmt(s.totalPrem) : dash) + '</td>' +
        '<td>' + (s.otmCount > 0 ? '$' + fmt(s.otmPrem) : dash) + '</td>' +
        '<td>' + (s.itmCount > 0 ? '$' + fmt(s.itmPrem) : dash) + '</td>' +
        '<td' + rateClass + '>' + (s.returnRate !== null ? s.returnRate.toFixed(1) + '%' : dash) + '<span class="ppnl-sub" style="display:block">' + (s.settled > 0 ? s.otmCount + '/' + s.settled : '') + '</span></td>' +
        '<td>' + (s.assignedNotional > 0 ? '$' + fmt(s.assignedNotional) : dash) + '</td>' +
      '</tr>';
    }).join('');

    el.innerHTML = '<table class="ppnl-mtbl">' +
      '<thead><tr>' +
        '<th>Month</th>' +
        '<th>Premium</th>' +
        '<th>Exp OTM</th>' +
        '<th>Exp ITM</th>' +
        '<th>Return Rate</th>' +
        '<th>Asgn Notional</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
  }
}

function cOpts(ttFmt, yFmt) {
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#131923', borderColor: '#232f47', borderWidth: 1,
        titleColor: '#cdd5e8', bodyColor: '#8090b0',
        titleFont: { family: 'DM Mono', size: 11 }, bodyFont: { family: 'DM Mono', size: 11 },
        callbacks: { label: ctx => ' ' + ttFmt(ctx.raw) }
      }
    },
    scales: {
      x: { ticks: { color:'#5a6680', font:{family:'DM Mono',size:10} }, grid: { color:'rgba(28,37,56,.8)' } },
      y: { ticks: { color:'#5a6680', font:{family:'DM Mono',size:10}, callback: yFmt }, grid: { color:'rgba(28,37,56,.8)' } }
    }
  };
}
