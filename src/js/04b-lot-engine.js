// ── LOT ENGINE ───────────────────────────────────────────────
// Pure per-asset wheel accounting. Walks one asset's trades in
// chronological order and produces:
//   - lots:              open + closed lot objects for the asset
//   - portfolioPnl:      realised asset-level P&L (premiums ± assignment/call
//                        cash flows)
//   - portfolioPremiums: total net premiums collected (puts + calls)
//   - putOnlyPnl:        running premium total from non-assigned PUTs
//   - tradeAccounting:   { [tradeId]: { lot, runningPnl, runningPremiums } }
//                        Snapshot of state immediately after this trade was
//                        processed. lot is { lotNum, lotSize, lotPremiums,
//                        lotCostBasis } or null. Captured because lot fields
//                        and running totals all mutate over time, so a
//                        post-hoc lookup is wrong.
//
// Invariants:
//   - HOLDING opens a new lot at costBasis = strike, no P&L debit
//   - ASSIGNED PUT debits portfolioPnl by strike*size AND credits the put's
//     net premium to the new lot's lotPremiums (so it reduces net cost like
//     subsequent calls do)
//   - CALL attaches by explicit lotNum, else to the currently open lot
//   - CALLED credits strike*calledSize to portfolioPnl, reduces the lot's
//     size, closes the lot if size hits zero
//   - CLOSED CALL: lot stays open (Hypersurface buy-to-close)

function lotEngine(assetTrades) {
  const sorted = assetTrades.slice()
    .sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);

  let portfolioPnl = 0;
  let portfolioPremiums = 0;
  let putOnlyPnl = 0;
  let lotCounter = 0;
  let openLot = null;

  const lots = [];
  const tradeAccounting = {};

  sorted.forEach(t => {
    const cc = t.closeCost || 0;
    const netPrem = t.premium - cc;
    portfolioPremiums += netPrem;
    portfolioPnl      += netPrem;
    if (t.type === 'PUT' && t.outcome !== 'ASSIGNED') putOnlyPnl += netPrem;

    if (t.type === 'HOLDING') {
      lotCounter++;
      openLot = {
        lotNum: lotCounter,
        startDate: t.date,
        costBasis: t.strike,
        size: t.size,
        lotPremiums: 0,
        putPremiums: 0,
        open: true,
        endDate: null,
        exitStrike: null,
        tradeIds: [t.id],
      };
      lots.push(openLot);

    } else if (t.outcome === 'ASSIGNED') {
      portfolioPnl -= t.strike * t.size;
      lotCounter++;
      openLot = {
        lotNum: lotCounter,
        startDate: t.date,
        costBasis: t.strike,
        size: t.size,
        lotPremiums: netPrem,
        open: true,
        endDate: null,
        exitStrike: null,
        tradeIds: [t.id],
      };
      lots.push(openLot);

    } else if (t.type === 'CALL') {
      let targetLot = null;
      if (t.lotNum != null) {
        targetLot = lots.find(l => l.lotNum === t.lotNum && l.open) || null;
      }
      if (!targetLot) targetLot = openLot;
      if (targetLot) {
        targetLot.lotPremiums += netPrem;
        targetLot.tradeIds.push(t.id);
        if (t.outcome === 'CALLED') {
          const calledSize = Math.min(t.size, targetLot.size);
          portfolioPnl += t.strike * calledSize;
          targetLot.size -= calledSize;
          if (targetLot.size <= 0) {
            targetLot.open = false;
            targetLot.endDate = t.date;
            targetLot.exitStrike = t.strike;
            if (openLot === targetLot) openLot = null;
          }
        }
      }
    }

    // Per-row display lot. Mirrors compute()'s previous rowLot logic.
    let snapLot = null;
    if (t.type === 'CALL') {
      if (t.lotNum != null) {
        snapLot = lots.find(l => l.lotNum === t.lotNum) || openLot;
      } else {
        snapLot = openLot;
      }
      if (t.outcome === 'CALLED') snapLot = null;
    } else if (t.type === 'HOLDING' || t.outcome === 'ASSIGNED') {
      snapLot = openLot;
    }

    tradeAccounting[t.id] = {
      lot: snapLot
        ? {
            lotNum: snapLot.lotNum,
            lotSize: snapLot.size,
            lotPremiums: snapLot.lotPremiums,
            lotCostBasis: snapLot.costBasis,
          }
        : null,
      runningPnl: portfolioPnl,
      runningPremiums: portfolioPremiums,
    };
  });

  return { lots, portfolioPnl, portfolioPremiums, putOnlyPnl, tradeAccounting };
}
