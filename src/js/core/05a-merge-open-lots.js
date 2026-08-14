// ── MERGE OPEN LOTS (pure helper) ─────────────────────────────
// Exports mergeOpenLots(trades, asset) -> newTrades

function mergeOpenLots(inputTrades, asset) {
  // Operates purely on a copy of the provided trades array and returns a new array
  const tradesCopy = JSON.parse(JSON.stringify(inputTrades || []));

  // Use the project's compute() by temporarily swapping the global `trades` so
  // compute() operates on the provided copy. This keeps the function pure
  // (no lasting global mutation) while reusing existing lot-identification
  // logic.
  const globalTrades = typeof trades !== 'undefined' ? trades : undefined;
  try {
    // Temporarily set global trades to our copy
    if (typeof window !== 'undefined') {
      // browser environment
      window.__merge_tmp_trades = window.trades;
      window.trades = JSON.parse(JSON.stringify(tradesCopy));
    } else if (typeof global !== 'undefined') {
      global.__merge_tmp_trades = global.trades;
      global.trades = JSON.parse(JSON.stringify(tradesCopy));
    }

    // Prefer lotEngine if available (pure per-asset engine)
    let assetLots = [];
    if (typeof lotEngine === 'function') {
      const assetTrades = tradesCopy.filter(t => t.asset === asset).sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
      const engine = lotEngine(assetTrades);
      assetLots = (engine && engine.lots) ? engine.lots.filter(l => l.open) : [];
    } else if (typeof compute === 'function') {
      // Temporarily swap global trades so compute() operates on our copy
      if (typeof window !== 'undefined') window.__merge_tmp_trades = window.trades;
      else if (typeof global !== 'undefined') global.__merge_tmp_trades = global.trades;
      try {
        if (typeof window !== 'undefined') window.trades = JSON.parse(JSON.stringify(tradesCopy));
        if (typeof global !== 'undefined') global.trades = JSON.parse(JSON.stringify(tradesCopy));
        const result = compute('ALL');
        assetLots = (result && result.lots && result.lots[asset]) ? result.lots[asset].filter(l => l.open) : [];
      } finally {
        if (typeof window !== 'undefined') {
          window.trades = window.__merge_tmp_trades;
          delete window.__merge_tmp_trades;
        }
        if (typeof global !== 'undefined') {
          global.trades = global.__merge_tmp_trades;
          delete global.__merge_tmp_trades;
        }
      }
    } else {
      // Fallback heuristic: treat HOLDING and ASSIGNED PUTs for this asset as open lot openers
      const openers = tradesCopy.filter(t => t.asset === asset && (t.type === 'HOLDING' || (t.type === 'PUT' && t.outcome === 'ASSIGNED')))
        .sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
      assetLots = openers.map((t, idx) => ({ lotNum: idx+1, startDate: t.date, costBasis: t.strike, size: t.size, lotPremiums: t.premium || 0, open: true, tradeIds: [t.id], netCost: (t.strike - ((t.premium||0)/t.size)) }));
    }

    if (assetLots.length < 2) return tradesCopy; // no-op

    // Gather merged totals
    let totalSize = 0, weightedCost = 0, totalCCPrem = 0;
    const lotOpenIds = new Set();
    assetLots.forEach(l => {
      totalSize += l.size;
      weightedCost += l.costBasis * l.size;
      totalCCPrem += l.lotPremiums || 0;
      if (l.tradeIds && l.tradeIds.length) lotOpenIds.add(l.tradeIds[0]);
    });
    const avgCost = weightedCost / totalSize;

    // Identify lot opener trades in the provided tradesCopy
    const lotOpeners = tradesCopy.filter(t => lotOpenIds.has(t.id) && t.asset === asset);
    lotOpeners.sort((a, b) => a.id - b.id);
    const keepTrade = lotOpeners[0];
    const removeIds = new Set(lotOpeners.slice(1).map(t => t.id));

    // Build new trades array: update kept opener, remove others, and clear CALL lotNum refs for this asset
    const newTrades = tradesCopy.map(t => Object.assign({}, t)).filter(t => !removeIds.has(t.id));

    if (keepTrade) {
      // Find the kept trade in newTrades and update
      const kt = newTrades.find(t => t.id === keepTrade.id);
      if (kt) {
        kt.strike = avgCost;
        kt.size = totalSize;
      }
    }

    // Clear explicit lotNum on CALLs for this asset so compute will attach them to the single lot
    newTrades.forEach(t => {
      if (t.asset === asset && t.type === 'CALL' && t.lotNum != null) {
        delete t.lotNum;
      }
    });

    return newTrades;
  } finally {
    // Restore original global trades
    if (typeof window !== 'undefined') {
      window.trades = window.__merge_tmp_trades;
      delete window.__merge_tmp_trades;
    } else if (typeof global !== 'undefined') {
      global.trades = global.__merge_tmp_trades;
      delete global.__merge_tmp_trades;
    }
  }
}

// Dual export footer: browser concat exposes globals; Node tests require module.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeOpenLots };
}

// Also expose globally in browser builds (concatenation relies on global function name)
if (typeof window !== 'undefined') window.mergeOpenLots = mergeOpenLots;
