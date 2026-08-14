// ── OUTCOME DISTRIBUTION ──────────────────────────────────────
// Pure helper: aggregates settled trades by outcome for the
// Position History donut. Excludes OPEN. Cash-flow lens: CLOSED
// premium is netted by closeCost.
//
// Returns [{outcome, count, premium}] in canonical order
// EXPIRED, ASSIGNED, CALLED, CLOSED. Outcomes with zero trades
// are omitted.

const _OUTCOME_ORDER = ['EXPIRED', 'ASSIGNED', 'CALLED', 'CLOSED'];

function outcomeDistribution(trades, assetFilter) {
  const filtered = (assetFilter && assetFilter !== 'ALL')
    ? trades.filter(t => t.asset === assetFilter)
    : trades;

  const acc = {};
  filtered.forEach(t => {
    if (!_OUTCOME_ORDER.includes(t.outcome)) return;
    const netPrem = (t.premium || 0) - (t.closeCost || 0);
    const slot = acc[t.outcome] || (acc[t.outcome] = { outcome: t.outcome, count: 0, premium: 0 });
    slot.count += 1;
    slot.premium += netPrem;
  });

  return _OUTCOME_ORDER.filter(o => acc[o]).map(o => acc[o]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { outcomeDistribution };
}
