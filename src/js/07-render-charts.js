// ── CUMULATIVE P&L HERO CHART
function setCpnlPeriod(p) {
  sCpnlPeriod = p;
  ['1M','3M','ALL'].forEach(x => {
    const b = document.getElementById('cpnl-btn-' + x);
    if (b) b.classList.toggle('active', x === p);
  });
  rCpnlChart(typeof window !== 'undefined' ? window.__cpnlTimeline : undefined);
}

function rCpnlChart(timeline) {
  const area = document.getElementById('cpnl-chart-area');
  if (!area) return;

  // Use provided timeline (from compute) if available
  if (!timeline || !timeline.length) {
    area.innerHTML = '<div class="cpnl-empty"><span style="font-size:1.6rem;opacity:.3">&#9196;</span>No trades yet</div>';
    const vEl = document.getElementById('cpnl-val');
    if (vEl) vEl.textContent = '—';
    const cEl = document.getElementById('cpnl-change');
    if (cEl) cEl.innerHTML = '';
    return;
  }

  // Build cumulative series from timeline (timeline entries are date-ordered snapshots)
  const allSeries = [{ date: timeline[0].date, val: 0 }];
  timeline.forEach(e => {
    const val = e.runningPremiums;
    const last = allSeries[allSeries.length - 1];
    if (last.date === e.date) { last.val = val; }
    else { allSeries.push({ date: e.date, val }); }
  });
  const totalPnl = allSeries.length ? allSeries[allSeries.length - 1].val : 0;

  // Period filter cutoff
  const today = new Date();
  let cutoff = null;
  if (sCpnlPeriod === '1M') {
    cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
  } else if (sCpnlPeriod === '3M') {
    cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
  }

  // Filter series for display period
  let dispSeries;
  if (!cutoff) {
    dispSeries = allSeries;
  } else {
    const cutStr = cutoff.toISOString().slice(0, 10);
    let baseline = 0;
    let lastBefore = allSeries.filter(p => p.date < cutStr);
    if (lastBefore.length) baseline = lastBefore[lastBefore.length - 1].val;
    const inPeriod = allSeries.filter(p => p.date >= cutStr);
    if (!inPeriod.length) {
      dispSeries = [{ date: cutStr, val: totalPnl }, { date: today.toISOString().slice(0, 10), val: totalPnl }];
    } else {
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
      cEl.innerHTML = '';
    }
  }

  // Canvas setup
  const DPR = window.devicePixelRatio || 1;
  const W = area.clientWidth || 800;
  const H = 186;

  area.innerHTML = '<div class="cpnl-canvas-wrap"><canvas id="cpnl-canvas"></canvas><div class="cpnl-dot" id="cpnl-dot" style="display:none"></div><div class="cpnl-tt" id="cpnl-tt" style="display:none"></div></div>';
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

  // Fritsch-Carlson monotone cubic interpolation — no overshoot, smooth curves
  function buildPath(points) {
    const n = points.length;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (n < 2) return;
    if (n === 2) { ctx.lineTo(points[1].x, points[1].y); return; }

    // Chord slopes
    const dx = [], dy = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = points[i+1].x - points[i].x || 1e-10;
      dy[i] = points[i+1].y - points[i].y;
      slope[i] = dy[i] / dx[i];
    }

    // Tangents
    const m = new Array(n);
    m[0] = slope[0];
    m[n-1] = slope[n-2];
    for (let i = 1; i < n - 1; i++) {
      if (slope[i-1] * slope[i] <= 0) {
        m[i] = 0;
      } else {
        m[i] = (slope[i-1] + slope[i]) / 2;
      }
    }

    // Monotonicity constraint (Fritsch-Carlson)
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(slope[i]) < 1e-10) { m[i] = m[i+1] = 0; continue; }
      const alpha = m[i] / slope[i];
      const beta  = m[i+1] / slope[i];
      const h = Math.sqrt(alpha * alpha + beta * beta);
      if (h > 3) {
        const t = 3 / h;
        m[i]   = t * alpha * slope[i];
        m[i+1] = t * beta  * slope[i];
      }
    }

    // Cubic Hermite segments
    for (let i = 0; i < n - 1; i++) {
      const hx = dx[i];
      ctx.bezierCurveTo(
        points[i].x + hx / 3,     points[i].y + m[i] * hx / 3,
        points[i+1].x - hx / 3,   points[i+1].y - m[i+1] * hx / 3,
        points[i+1].x,            points[i+1].y
      );
    }
  }

  const MTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function drawChart(hoverIdx) {
    ctx.clearRect(0, 0, W, H);

    // Gradient fill
    const gradFill = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    gradFill.addColorStop(0,   toRgba(lineColor, 0.22));
    gradFill.addColorStop(0.7, toRgba(lineColor, 0.06));
    gradFill.addColorStop(1,   toRgba(lineColor, 0));

    // Zero line
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

    // Hover crosshair + dot
    if (hoverIdx >= 0 && hoverIdx < pts.length) {
      const pt = pts[hoverIdx];
      ctx.save();
      ctx.strokeStyle = muColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(pt.x, pad.top);
      ctx.lineTo(pt.x, pad.top + cH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }
  }

  drawChart(-1);

  // Animated end dot
  const lastPt = pts[pts.length - 1];
  const dotEl = document.getElementById('cpnl-dot');
  if (dotEl && lastPt) {
    dotEl.style.display = 'block';
    dotEl.style.left = lastPt.x + 'px';
    dotEl.style.top = lastPt.y + 'px';
    dotEl.style.color = lineColor;
  }

  // Tooltip element
  const ttEl = document.getElementById('cpnl-tt');

  // Hover events
  canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find nearest point by X
    let nearest = -1, nearestDist = Infinity;
    pts.forEach(function(pt, i) {
      const dist = Math.abs(pt.x - mouseX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });

    if (nearest >= 0 && mouseX >= pad.left - 8 && mouseX <= pad.left + cW + 8) {
      if (dotEl) dotEl.style.display = 'none';
      drawChart(nearest);

      const pt = pts[nearest];
      const dp = dispSeries[nearest];
      const d = new Date(dp.date + 'T12:00:00');
      const dateStr = MTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
      const valStr = (dp.val >= 0 ? '+$' : '-$') + fmt(Math.abs(dp.val));

      if (ttEl) {
        ttEl.innerHTML = '<span class="cpnl-tt-date">' + dateStr + '</span><span class="cpnl-tt-val" style="color:' + lineColor + '">' + valStr + '</span>';
        ttEl.style.display = 'flex';
        // Position: prefer right of crosshair, flip left if near edge
        const ttW = 180;
        let left = pt.x + 12;
        if (left + ttW > W - pad.right) left = pt.x - ttW - 12;
        ttEl.style.left = Math.max(pad.left, left) + 'px';
        ttEl.style.top = (pad.top + 4) + 'px';
      }
    } else {
      drawChart(-1);
      if (dotEl) dotEl.style.display = 'block';
      if (ttEl) ttEl.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', function() {
    drawChart(-1);
    if (dotEl) dotEl.style.display = 'block';
    if (ttEl) ttEl.style.display = 'none';
  });

  // ── NET P&L SPARKLINE ─────────────────────────────────────────
  const { allRows: cpnlAllRows } = compute('ALL');
  const cpnlAssignedLots = new Set();
  cpnlAllRows.forEach(r => { if (r.outcome === 'ASSIGNED' && r.lotNum != null) cpnlAssignedLots.add(r.lotNum); });

  const netEvts = [];
  cpnlAllRows.forEach(r => {
    if (r.type === 'HOLDING') return;
    const ed = r.outcome === 'OPEN' ? r.date : r.expiry;
    if (!ed) return;
    let delta = (r.premium || 0) - (r.closeCost || 0);
    if (r.outcome === 'ASSIGNED') delta -= (r.strike || 0) * (r.size || 0);
    if (r.outcome === 'CALLED' && cpnlAssignedLots.has(r.lotNum)) delta += (r.strike || 0) * (r.size || 0);
    netEvts.push({ date: ed, delta });
  });
  netEvts.sort((a, b) => a.date.localeCompare(b.date));

  let netRun = 0;
  const netAllSeries = netEvts.length ? [{ date: netEvts[0].date, val: 0 }] : [];
  netEvts.forEach(e => {
    netRun += e.delta;
    const nlast = netAllSeries[netAllSeries.length - 1];
    if (nlast.date === e.date) nlast.val = netRun;
    else netAllSeries.push({ date: e.date, val: netRun });
  });

  const nValEl = document.getElementById('npnl-val');
  if (nValEl) {
    nValEl.style.color = netRun >= 0 ? greenColor : redColor;
    nValEl.textContent = netEvts.length ? (netRun >= 0 ? '+$' : '-$') + fmt(Math.abs(netRun)) : '—';
  }

  let netDisp;
  if (!cutoff || !netAllSeries.length) {
    netDisp = netAllSeries;
  } else {
    const cutStr = cutoff.toISOString().slice(0, 10);
    const lastBefore = netAllSeries.filter(p => p.date < cutStr);
    const baseline = lastBefore.length ? lastBefore[lastBefore.length - 1].val : 0;
    const inPeriod = netAllSeries.filter(p => p.date >= cutStr);
    netDisp = inPeriod.length
      ? [{ date: cutStr, val: baseline }, ...inPeriod]
      : [{ date: cutStr, val: netRun }, { date: todayStr, val: netRun }];
  }
  if (netDisp.length && netDisp[netDisp.length - 1].date < todayStr) {
    netDisp = [...netDisp, { date: todayStr, val: netDisp[netDisp.length - 1].val }];
  }

  const nArea = document.getElementById('npnl-chart-area');
  const hasAssignments = cpnlAllRows.some(r => r.outcome === 'ASSIGNED');
  if (nArea && !hasAssignments) {
    nArea.innerHTML = '<div class="npnl-no-asgn">No assignment losses &mdash; Net P&amp;L equals Premium Income</div>';
  } else if (nArea && netDisp.length >= 2) {
    const nW = nArea.clientWidth || W;
    const nH = 88;
    nArea.innerHTML = '<canvas id="npnl-canvas"></canvas>';
    const nCanvas = document.getElementById('npnl-canvas');
    nCanvas.width = nW * DPR; nCanvas.height = nH * DPR;
    nCanvas.style.width = nW + 'px'; nCanvas.style.height = nH + 'px';
    const nCtx = nCanvas.getContext('2d');
    nCtx.scale(DPR, DPR);

    const nPad = { top: 8, right: 24, bottom: 8, left: 56 };
    const ncW = nW - nPad.left - nPad.right;
    const ncH = nH - nPad.top - nPad.bottom;
    const nVals = netDisp.map(p => p.val);
    const nMinV = Math.min(0, ...nVals);
    const nMaxV = Math.max(0, ...nVals);
    const nSpread = nMaxV - nMinV || 1;
    const nDates = netDisp.map(p => new Date(p.date + 'T12:00:00').getTime());
    const nMinD = nDates[0], nMaxD = nDates[nDates.length - 1];
    const nDateSpan = nMaxD - nMinD || 1;

    function nToX(d) { return nPad.left + ((d - nMinD) / nDateSpan) * ncW; }
    function nToY(v) { return nPad.top + (1 - (v - nMinV) / nSpread) * ncH; }

    const nPts = netDisp.map((p, i) => ({ x: nToX(nDates[i]), y: nToY(p.val) }));
    const nZeroY = nToY(0);
    const nLineColor = netDisp[netDisp.length - 1].val >= netDisp[0].val ? greenColor : redColor;
    const nGrad = nCtx.createLinearGradient(0, nPad.top, 0, nPad.top + ncH);
    nGrad.addColorStop(0, toRgba(nLineColor, 0.18));
    nGrad.addColorStop(1, toRgba(nLineColor, 0));

    // Zero line
    nCtx.save();
    nCtx.strokeStyle = bdColor; nCtx.lineWidth = 1;
    nCtx.setLineDash([3, 3]); nCtx.globalAlpha = 0.4;
    nCtx.beginPath(); nCtx.moveTo(nPad.left, nZeroY); nCtx.lineTo(nPad.left + ncW, nZeroY);
    nCtx.stroke(); nCtx.setLineDash([]); nCtx.globalAlpha = 1; nCtx.restore();

    // Gradient fill
    nCtx.save();
    nCtx.beginPath(); nCtx.moveTo(nPts[0].x, nPts[0].y);
    nPts.slice(1).forEach(pt => nCtx.lineTo(pt.x, pt.y));
    nCtx.lineTo(nPts[nPts.length - 1].x, Math.min(nZeroY, nPad.top + ncH));
    nCtx.lineTo(nPts[0].x, Math.min(nZeroY, nPad.top + ncH));
    nCtx.closePath(); nCtx.fillStyle = nGrad; nCtx.fill(); nCtx.restore();

    // Line
    nCtx.save();
    nCtx.strokeStyle = nLineColor; nCtx.lineWidth = 1.5;
    nCtx.lineJoin = 'round'; nCtx.lineCap = 'round';
    nCtx.beginPath(); nCtx.moveTo(nPts[0].x, nPts[0].y);
    nPts.slice(1).forEach(pt => nCtx.lineTo(pt.x, pt.y));
    nCtx.stroke(); nCtx.restore();

    // Y labels (min and max)
    nCtx.save();
    nCtx.fillStyle = muColor; nCtx.font = '10px monospace'; nCtx.textAlign = 'right';
    [nMinV, nMaxV].forEach(v => {
      const lbl = (v >= 0 ? '' : '-') + '$' + (Math.abs(v) >= 1000 ? (Math.abs(v)/1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0));
      nCtx.fillText(lbl, nPad.left - 6, nToY(v) + 3.5);
    });
    nCtx.restore();
  } else if (nArea) {
    nArea.innerHTML = '';
  }
}

function rCharts(displayRows, timeline) {
  rCpnlChart(timeline);
  const el = document.getElementById('ppnl-body');
  if (!el) return;

  function calcStats(rows) {
    let totalPrem = 0, totalCount = 0;
    let otmCount = 0, itmCount = 0;
    let openCount = 0;
    let aprWeightedSum = 0, aprWeightTotal = 0;
    let assignmentLoss = 0, callAwayCredit = 0, totalNotional = 0;
    // Only credit call-aways for lots opened via assignment, not spot HOLDINGs
    const assignedLotNums = new Set();
    rows.forEach(r => { if (r.outcome === 'ASSIGNED' && r.lotNum != null) assignedLotNums.add(r.lotNum); });
    rows.forEach(r => {
      if (r.type === 'HOLDING') return;
      const net = (r.premium || 0) - (r.closeCost || 0);
      const notional = (r.strike || 0) * (r.size || 0);
      totalPrem += net;
      totalNotional += notional;
      totalCount++;
      if (r.outcome === 'OPEN') { openCount++; }
      else if (r.outcome === 'EXPIRED') otmCount++;
      else if (r.outcome === 'ASSIGNED') { itmCount++; assignmentLoss += notional; }
      else if (r.outcome === 'CALLED') {
        itmCount++;
        if (assignedLotNums.has(r.lotNum)) callAwayCredit += notional;
      }
      const a = computeAnnualForRow(r);
      if (a != null) {
        aprWeightedSum += a * notional;
        aprWeightTotal += notional;
      }
    });
    const settled = otmCount + itmCount;
    const returnRate = settled > 0 ? otmCount / settled * 100 : null;
    const portfolioAPR = aprWeightTotal > 0 ? aprWeightedSum / aprWeightTotal : null;
    const netPnl = totalPrem - assignmentLoss + callAwayCredit;
    return { totalPrem, totalCount, otmCount, itmCount, openCount, returnRate, settled, portfolioAPR, assignmentLoss, callAwayCredit, netPnl, totalNotional };
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
    const netPnlColor = s.netPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const netPnlStr = s.totalCount > 0
      ? '<span style="color:' + netPnlColor + '">' + (s.netPnl >= 0 ? '+$' : '-$') + fmt(Math.abs(s.netPnl)) + '</span>'
      : dash;
    el.className = 'ppnl-cards';
    el.innerHTML = [
      card('Total Premium Collected',
        s.totalCount > 0 ? '$' + fmt(s.totalPrem) : dash,
        s.totalCount > 0 ? pos(s.settled) + ' settled' + (s.openCount > 0 ? ' · ' + s.openCount + ' open' : '') : ''),
      card('Net P&amp;L',
        netPnlStr,
        s.assignmentLoss > 0 ? '$' + fmt(s.assignmentLoss) + ' assignment loss' : (s.totalCount > 0 ? 'no assignments' : '')),
      card('Total Notional',
        s.totalNotional > 0 ? '$' + fmt(s.totalNotional) : dash,
        s.totalCount > 0 ? pos(s.totalCount) + (s.openCount > 0 ? ' · ' + s.openCount + ' open' : '') : ''),
      card('Portfolio APR',
        s.portfolioAPR !== null ? s.portfolioAPR.toFixed(1) + '%' : dash,
        s.settled > 0 ? 'notional-weighted · ' + s.settled + ' settled' : ''),
      card('Return Rate',
        s.returnRate !== null ? s.returnRate.toFixed(1) + '%' : dash,
        s.settled > 0 ? s.otmCount + ' / ' + s.settled + ' exp OTM' : ''),
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
      const mnColor = s.netPnl >= 0 ? 'var(--green)' : 'var(--red)';
      const mnStr = s.totalCount > 0
        ? '<span style="color:' + mnColor + '">' + (s.netPnl >= 0 ? '+$' : '-$') + fmt(Math.abs(s.netPnl)) + '</span>'
        : dash;
      return '<tr>' +
        '<td>' + fmtMonth(ym) + '</td>' +
        '<td>' + (s.totalCount > 0 ? '$' + fmt(s.totalPrem) : dash) + '</td>' +
        '<td>' + mnStr + '</td>' +
        '<td>' + (s.portfolioAPR !== null ? s.portfolioAPR.toFixed(1) + '%' : dash) + '</td>' +
        '<td' + rateClass + '>' + (s.returnRate !== null ? s.returnRate.toFixed(1) + '%' : dash) + '<span class="ppnl-sub" style="display:block">' + (s.settled > 0 ? s.otmCount + '/' + s.settled : '') + '</span></td>' +
      '</tr>';
    }).join('');

    el.innerHTML = '<table class="ppnl-mtbl">' +
      '<thead><tr>' +
        '<th>Month</th>' +
        '<th>Premium</th>' +
        '<th>Net P&amp;L</th>' +
        '<th>Portfolio APR</th>' +
        '<th>Return Rate</th>' +
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
