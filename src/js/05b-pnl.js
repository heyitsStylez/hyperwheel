// ── PNL CALCULATOR (cash-flow lens) ──────────────────────────
// Pure module. Realised P&L is settled-events only:
//   Σ(net premiums of all settled options)
//   + Σ over CALLED events of (strike − costBasis) × calledSize
// Open options and open lots contribute zero. CLOSED CALL with
// closeCost > premium contributes a negative netPrem cleanly.
//
// Slice 1: Realised path only. Unrealised + Total land in Slice 2.

function computePnl(trades, assetFilter) {
  const engine = (typeof lotEngine !== 'undefined')
    ? lotEngine
    : require('./04b-lot-engine.js').lotEngine;

  const filtered = (assetFilter && assetFilter !== 'ALL')
    ? trades.filter(t => t.asset === assetFilter)
    : trades;

  const byAsset = {};
  filtered.forEach(t => {
    (byAsset[t.asset] = byAsset[t.asset] || []).push(t);
  });

  let realised = 0;
  const events = [];

  Object.keys(byAsset).forEach(asset => {
    const assetTrades = byAsset[asset];
    const { lots } = engine(assetTrades);

    assetTrades.forEach(t => {
      if (t.type === 'HOLDING') return;
      if (t.outcome === 'OPEN') return;
      const netPrem = (t.premium || 0) - (t.closeCost || 0);
      realised += netPrem;

      let delta = netPrem;
      if (t.type === 'CALL' && t.outcome === 'CALLED') {
        const lot = lots.find(l => l.tradeIds.includes(t.id));
        if (lot) {
          const gain = (t.strike - lot.costBasis) * t.size;
          realised += gain;
          delta += gain;
        }
      }
      events.push({ date: t.expiry || t.date, delta });
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  const realisedSeries = [];
  events.forEach(e => {
    run += e.delta;
    const last = realisedSeries[realisedSeries.length - 1];
    if (last && last.date === e.date) last.val = run;
    else realisedSeries.push({ date: e.date, val: run });
  });

  return { realised, realisedSeries };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computePnl };
}
