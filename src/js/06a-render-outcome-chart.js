// ── HISTORY OUTCOME CHART (TREEMAP) ───────────────────────────
// Renders a horizontal treemap of settled-outcome distribution
// above the Position History table when there are >= 10 settled
// trades (excluding OPEN). Below threshold the existing pills
// remain. Each cell toggles the outcome filter via setHistOutcome.

const _OUTCHART_THRESHOLD = 10;
const _OUTCHART_COLORS = {
  EXPIRED:  'var(--green)',
  ASSIGNED: 'var(--red)',
  CALLED:   'var(--orange)',
  CLOSED:   'var(--blue)',
};

function rOutcomeChart() {
  const wrap  = document.getElementById('hist-outchart');
  const pills = document.getElementById('hist-pills');
  if (!wrap || !pills) return;

  const dist = outcomeDistribution(trades, sFilter);
  const total = dist.reduce((s, d) => s + d.count, 0);

  if (total < _OUTCHART_THRESHOLD) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    pills.style.display = '';
    return;
  }
  pills.style.display = 'none';
  wrap.style.display  = '';

  const active = sHistOutcome && sHistOutcome !== 'ALL' ? sHistOutcome : null;

  let cellsHtml = '';
  dist.forEach(d => {
    let cls = 'outchart-cell';
    if (active === d.outcome) cls += ' active';
    else if (active) cls += ' dim';
    const premStr = '$' + fmt(d.premium);
    cellsHtml += '<div class="' + cls + '"'
      + ' data-outcome="' + d.outcome + '"'
      + ' style="flex:' + d.count + ';background:' + _OUTCHART_COLORS[d.outcome] + '">'
      + '<span class="outchart-out">' + d.outcome + '</span>'
      + '<span class="outchart-cnt">' + d.count + '</span>'
      + '<span class="outchart-prem">' + premStr + '</span>'
      + '</div>';
  });

  wrap.innerHTML = '<div class="outchart-meta">'
    + '<span>Outcome distribution</span>'
    + '<span><b>' + total + '</b> settled · click a cell to filter</span>'
    + '</div>'
    + '<div class="outchart-treemap">' + cellsHtml + '</div>'
    + '<div class="outchart-tip" id="outchart-tip"></div>';

  const tip = document.getElementById('outchart-tip');
  wrap.querySelectorAll('.outchart-cell').forEach(el => {
    const o = el.getAttribute('data-outcome');
    const d = dist.find(x => x.outcome === o);
    el.addEventListener('click', () => {
      setHistOutcome(sHistOutcome === o ? 'ALL' : o);
    });
    el.addEventListener('mousemove', e => {
      if (!d || !tip) return;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY + 12) + 'px';
      tip.textContent = o + ' — ' + d.count + ' trade' + (d.count === 1 ? '' : 's')
        + ', $' + fmt(d.premium) + ' total premium';
    });
    el.addEventListener('mouseleave', () => { if (tip) tip.style.display = 'none'; });
  });
}
