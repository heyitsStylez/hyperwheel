// ── HISTORY OUTCOME DONUT ─────────────────────────────────────
// Renders an SVG donut chart of settled-outcome distribution
// above the Position History table when there are >= 10 settled
// trades (excluding OPEN). Below threshold, the existing pills
// remain. Each slice toggles the outcome filter via setHistOutcome.

const _DONUT_THRESHOLD = 10;
const _DONUT_COLORS = {
  EXPIRED:  'var(--green)',
  ASSIGNED: 'var(--red)',
  CALLED:   'var(--orange)',
  CLOSED:   'var(--blue)',
};

function _donutArc(cx, cy, rOuter, rInner, a0, a1) {
  const x0 = cx + rOuter * Math.cos(a0), y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1), y1 = cy + rOuter * Math.sin(a1);
  const x2 = cx + rInner * Math.cos(a1), y2 = cy + rInner * Math.sin(a1);
  const x3 = cx + rInner * Math.cos(a0), y3 = cy + rInner * Math.sin(a0);
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return 'M' + x0 + ',' + y0
       + ' A' + rOuter + ',' + rOuter + ' 0 ' + large + ' 1 ' + x1 + ',' + y1
       + ' L' + x2 + ',' + y2
       + ' A' + rInner + ',' + rInner + ' 0 ' + large + ' 0 ' + x3 + ',' + y3
       + ' Z';
}

function rHistDonut() {
  const wrap  = document.getElementById('hist-donut');
  const pills = document.getElementById('hist-pills');
  if (!wrap || !pills) return;

  const dist = outcomeDistribution(trades, sFilter);
  const total = dist.reduce((s, d) => s + d.count, 0);

  if (total < _DONUT_THRESHOLD) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    pills.style.display = '';
    return;
  }
  pills.style.display = 'none';
  wrap.style.display  = '';

  const cx = 80, cy = 80, rOuter = 68, rInner = 44;
  const active = sHistOutcome && sHistOutcome !== 'ALL' ? sHistOutcome : null;

  let slicesHtml = '';
  let angle = -Math.PI / 2;
  const sliceMeta = [];
  dist.forEach(d => {
    const span = (d.count / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + span;
    const path = _donutArc(cx, cy, rOuter, rInner, a0, a1);
    let cls = 'hist-donut-slice';
    if (active === d.outcome) cls += ' active';
    else if (active) cls += ' dim';
    slicesHtml += '<path d="' + path + '" fill="' + _DONUT_COLORS[d.outcome]
      + '" class="' + cls + '" data-outcome="' + d.outcome + '"></path>';
    sliceMeta.push(d);
    angle = a1;
  });

  const centreNum = active ? (dist.find(d => d.outcome === active) || {}).count || 0 : total;
  const centreLbl = active ? active : 'Settled';

  const svg = '<svg class="hist-donut-svg" width="160" height="160" viewBox="0 0 160 160" aria-label="Outcome distribution">'
    + slicesHtml
    + '<text x="80" y="74" class="hist-donut-center hist-donut-center-num">' + centreNum + '</text>'
    + '<text x="80" y="92" class="hist-donut-center hist-donut-center-lbl">' + centreLbl + '</text>'
    + '</svg>';

  let legend = '<div class="hist-donut-legend">';
  dist.forEach(d => {
    let cls = 'hist-donut-legend-item';
    if (active === d.outcome) cls += ' active';
    else if (active) cls += ' dim';
    const premCls = d.premium < 0 ? ' neg' : '';
    legend += '<div class="' + cls + '" data-outcome="' + d.outcome + '">'
      + '<span class="hist-donut-swatch" style="background:' + _DONUT_COLORS[d.outcome] + '"></span>'
      + '<span class="hist-donut-out">' + d.outcome + '</span>'
      + '<span class="hist-donut-cnt">' + d.count + ' trade' + (d.count === 1 ? '' : 's') + '</span>'
      + '<span class="hist-donut-prem' + premCls + '">$' + fmt(d.premium) + '</span>'
      + '</div>';
  });
  legend += '</div>';

  wrap.innerHTML = svg + legend
    + '<div class="hist-donut-tip" id="hist-donut-tip"></div>';

  const tip = document.getElementById('hist-donut-tip');
  const onClick = outcome => () => {
    setHistOutcome(sHistOutcome === outcome ? 'ALL' : outcome);
  };
  wrap.querySelectorAll('.hist-donut-slice').forEach(el => {
    const o = el.getAttribute('data-outcome');
    el.addEventListener('click', onClick(o));
    el.addEventListener('mousemove', e => {
      const d = sliceMeta.find(x => x.outcome === o);
      if (!d || !tip) return;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY + 12) + 'px';
      tip.textContent = o + ' — ' + d.count + ' trade' + (d.count === 1 ? '' : 's')
        + ', $' + fmt(d.premium) + ' total premium';
    });
    el.addEventListener('mouseleave', () => { if (tip) tip.style.display = 'none'; });
  });
  wrap.querySelectorAll('.hist-donut-legend-item').forEach(el => {
    el.addEventListener('click', onClick(el.getAttribute('data-outcome')));
  });
}
