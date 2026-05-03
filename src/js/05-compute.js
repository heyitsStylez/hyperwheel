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
  const engines = {};

  assets.forEach(a => {
    const assetTrades = trades.filter(t => t.asset === a)
      .sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);

    const engine = lotEngine(assetTrades);
    engines[a] = engine;
    lots[a] = engine.lots;
    const openNow = engine.lots.find(l => l.open);

    const enriched = assetTrades.map((t, i) => {
      const cc = t.closeCost || 0;
      const netPrem = t.premium - cc;
      const acc = engine.tradeAccounting[t.id];
      const snap = acc.lot;

      let nc = null, lotNum = null, lotSize = null, lotCostBasis = null;
      if (snap) {
        nc = lotNetCost(snap.lotSize, snap.lotCostBasis, snap.lotPremiums);
        lotNum = snap.lotNum;
        lotSize = snap.lotSize;
        lotCostBasis = snap.lotCostBasis;
      }

      const collateral = t.strike * t.size;
      const dte        = t.dte && t.dte > 0 ? t.dte : null;
      // display fields (returnPct/monthly/annual/lotPnl) are computed in the renderer
      // compute() only provides accounting snapshot fields (nc, lotNum, lotSize, lotCostBasis)


      return {
        ...t,
        assetIdx: i + 1,
        pnl: acc.runningPnl,
        totPr: acc.runningPremiums,
        nc,
        held: openNow ? openNow.size : null,
        lotNum,
        lotSize,
        lotCostBasis,
      };
    });

    streams[a] = enriched;
  });

  // Build combined timeline from per-asset engines (one snapshot per processed trade)
  const events = [];
  assets.forEach(a => {
    const eng = engines[a];
    if (!eng || !eng.timeline) return;
    let prevPnl = 0, prevPrem = 0;
    eng.timeline.forEach(entry => {
      const dPnl = entry.runningPnl - prevPnl;
      const dPrem = entry.runningPremiums - prevPrem;
      events.push({ date: entry.date, dPnl, dPrem });
      prevPnl = entry.runningPnl;
      prevPrem = entry.runningPremiums;
    });
  });
  events.sort((x, y) => x.date.localeCompare(y.date));
  let runningPnl = 0, runningPremiums = 0;
  const timeline = [];
  events.forEach(e => {
    runningPnl += e.dPnl;
    runningPremiums += e.dPrem;
    timeline.push({ date: e.date, runningPnl, runningPremiums });
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

  return { streams, lots, allRows, displayRows, timeline };
}
