// ── COMPUTE (lot-aware, multi-wheel per asset) ───────────────
// Architecture:
//   - PUT trades: portfolio-level income (pre-assignment)
//   - HOLDING / ASSIGNED: starts a new LOT with its own cost basis
//   - CALL trades: attached to the currently open lot for that asset
//   - CALLED outcome: closes the lot
// Each lot tracks: costBasis, size, lotPremiums (calls only), netCost
// Portfolio-level P&L includes all premiums + assignment debits/credits

function compute(assetFilter) {
  const assets = ['BTC', 'ETH', 'HYPE', 'SOL'];
  const streams = {};  // per-asset flat rows with enriched fields
  const lots = {};     // per-asset array of lot objects

  assets.forEach(a => {
    const assetTrades = trades.filter(t => t.asset === a);
    let portfolioPnl = 0;      // tracks full P&L inc. assignment debits
    let portfolioPremiums = 0; // total premiums (puts + calls) for asset
    let putOnlyPnl = 0;        // running premiums from non-assigned PUTs only
    let lotCounter = 0;
    let openLot = null;        // currently open lot

    const lotList = [];        // all lots (open + closed) for this asset
    const enriched = [];

    assetTrades.forEach((t, i) => {
      const cc = t.closeCost || 0;
      const netPrem = t.premium - cc;
      portfolioPremiums += netPrem;
      portfolioPnl      += netPrem;
      if (t.type === 'PUT' && t.outcome !== 'ASSIGNED') putOnlyPnl += netPrem;

      // ── LOT LIFECYCLE ──────────────────────────────────────
      if (t.type === 'HOLDING') {
        // Spot entry — open a new lot, don't debit P&L
        lotCounter++;
        openLot = {
          lotNum: lotCounter,
          startDate: t.date,
          costBasis: t.strike,
          size: t.size,
          lotPremiums: 0,   // call premiums collected on this lot
          putPremiums: 0,   // put premiums attributed at lot level (none yet)
          open: true,
          endDate: null,
          exitStrike: null,
          tradeIds: [t.id],
        };
        lotList.push(openLot);

      } else if (t.outcome === 'ASSIGNED') {
        // Put gets assigned — debit P&L, open new lot
        portfolioPnl -= t.strike * t.size;
        lotCounter++;
        openLot = {
          lotNum: lotCounter,
          startDate: t.date,
          costBasis: t.strike,
          size: t.size,
          lotPremiums: 0,
          open: true,
          endDate: null,
          exitStrike: null,
          tradeIds: [t.id],
        };
        lotList.push(openLot);

      } else if (t.type === 'CALL') {
        // Find the correct lot: explicit lotNum takes priority over openLot
        let targetLot = null;
        if (t.lotNum != null) {
          targetLot = lotList.find(l => l.lotNum === t.lotNum && l.open) || null;
        }
        if (!targetLot) targetLot = openLot;
        if (targetLot) {
          targetLot.lotPremiums += netPrem;
          targetLot.tradeIds.push(t.id);
          if (t.outcome === 'CALLED') {
            // Lot closed — asset called away
            portfolioPnl += t.strike * targetLot.size;
            targetLot.open = false;
            targetLot.endDate = t.date;
            targetLot.exitStrike = t.strike;
            if (openLot === targetLot) openLot = null;
          }
          // CLOSED call: lot stays open — position was bought back early
        }
      }
      // PUT (not assigned) — portfolio level only, no lot attachment

      // ── PER-ROW ENRICHMENT ─────────────────────────────────
      // For CALL rows with an explicit lotNum, display that lot's data.
      // For everything else, use openLot.
      let rowLot = null;
      if (t.type === 'CALL') {
        if (t.lotNum != null) {
          rowLot = lotList.find(l => l.lotNum === t.lotNum) || openLot;
        } else {
          rowLot = openLot;
        }
        // CALLED closes the lot — suppress net cost on the closing row
        if (t.outcome === 'CALLED') rowLot = null;
      } else if (t.type === 'HOLDING' || t.outcome === 'ASSIGNED') {
        rowLot = openLot; // the lot just created above
      }
      let nc = null, lotNum = null, lotSize = null, lotCostBasis = null;
      if (rowLot) {
        nc = rowLot.costBasis - (rowLot.lotPremiums / rowLot.size);
        lotNum = rowLot.lotNum;
        lotSize = rowLot.size;
        lotCostBasis = rowLot.costBasis;
      }

      const collateral = t.strike * t.size;
      const returnPct  = collateral > 0 ? (netPrem / collateral) * 100 : null;
      const dte        = t.dte && t.dte > 0 ? t.dte : null;
      const monthly    = (returnPct !== null && dte) ? returnPct / dte * 30  : null;
      const annual     = (returnPct !== null && dte) ? returnPct / dte * 365 : null;

      // lotPnl: running premium total for CALLs in a lot, or individual premium for PUTs
      let lotPnl = null;
      if (t.type === 'CALL' && rowLot) {
        lotPnl = rowLot.lotPremiums;
      } else if (t.type === 'PUT' && t.outcome !== 'ASSIGNED') {
        lotPnl = netPrem;
      }

      enriched.push({
        ...t,
        assetIdx: i + 1,
        pnl: portfolioPnl,
        totPr: portfolioPremiums,
        nc,
        lotPnl,
        held: openLot ? openLot.size : null,
        lotNum,
        lotSize,
        lotCostBasis,
        returnPct, monthly, annual,
      });
    });

    streams[a] = enriched;
    lots[a] = lotList;
  });

  // ── COMBINE & SORT ─────────────────────────────────────────
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
