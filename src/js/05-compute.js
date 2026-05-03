// ── COMPUTE ──────────────────────────────────────────────────
// Orchestrator: per-asset, runs the lot engine then enriches each
// trade with display fields (return%, monthly/annual, lotPnl, net
// cost) for the open + history tables. Cross-asset sort + filter
// at the end.
//
// All wheel-strategy accounting (lot lifecycle, portfolio P&L,
// assigned-PUT premium credit) lives in lotEngine — this file is
// presentation-shape only.

function compute(assetFilter) {
  const assets = ['BTC', 'ETH', 'HYPE', 'SOL'];
  const streams = {};
  const lots = {};

  assets.forEach(a => {
    const assetTrades = trades.filter(t => t.asset === a)
      .sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);

    const engine = lotEngine(assetTrades);
    lots[a] = engine.lots;
    const openNow = engine.lots.find(l => l.open);

    const enriched = assetTrades.map((t, i) => {
      const cc = t.closeCost || 0;
      const netPrem = t.premium - cc;
      const acc = engine.tradeAccounting[t.id];
      const snap = acc.lot;

      let nc = null, lotNum = null, lotSize = null, lotCostBasis = null;
      if (snap) {
        nc = snap.netCost;
        lotNum = snap.lotNum;
        lotSize = snap.lotSize;
        lotCostBasis = snap.lotCostBasis;
      }

      const collateral = t.strike * t.size;
      const returnPct  = collateral > 0 ? (netPrem / collateral) * 100 : null;
      const dte        = t.dte && t.dte > 0 ? t.dte : null;
      const monthly    = (returnPct !== null && dte) ? returnPct / dte * 30  : null;
      const annual     = (returnPct !== null && dte) ? returnPct / dte * 365 : null;

      let lotPnl = null;
      if (t.type === 'CALL' && snap) {
        lotPnl = snap.lotPremiums;
      } else if (t.type === 'PUT' && t.outcome !== 'ASSIGNED') {
        lotPnl = netPrem;
      }

      return {
        ...t,
        assetIdx: i + 1,
        pnl: acc.runningPnl,
        totPr: acc.runningPremiums,
        nc,
        lotPnl,
        held: openNow ? openNow.size : null,
        lotNum,
        lotSize,
        lotCostBasis,
        returnPct, monthly, annual,
      };
    });

    streams[a] = enriched;
  });

  let allRows = [];
  assets.forEach(a => streams[a].forEach(r => allRows.push(r)));
  allRows.sort((a, b) => {
    if (a.asset !== b.asset) return a.asset.localeCompare(b.asset);
    const aLot = a.lotNum ?? 0;
    const bLot = b.lotNum ?? 0;
    if (aLot !== bLot) return aLot - bLot;
    return a.date.localeCompare(b.date) || a.id - b.id;
  });
  allRows = allRows.map((r, i) => ({ ...r, idx: i + 1 }));

  const displayRows = assetFilter && assetFilter !== 'ALL'
    ? allRows.filter(r => r.asset === assetFilter)
    : allRows;

  return { streams, lots, allRows, displayRows };
}
