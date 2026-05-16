// ── CHAIN APPLY ───────────────────────────────────────────────────────────────
// Pure helpers for importing chain trades into the local trades array.
// Parameterised on `tradesArray` rather than the global `trades` — safe to
// require() from Node tests with no browser context.

function applyCloseTrade(tradesArray, closeTrade) {
  const match = tradesArray.find(t =>
    t.asset   === closeTrade.asset &&
    t.type    === closeTrade.type &&
    t.expiry  === closeTrade.expiry &&
    Math.abs(t.strike - closeTrade.strike) < 0.01 &&
    t.outcome === 'OPEN'
  );
  if (!match) return false;
  match.outcome   = 'CLOSED';
  match.closeCost = Math.abs(closeTrade.premium);
  return true;
}

// Apply a batch of pre-parsed chain trades to tradesArray.
// openTrades / closeTrades are split by the caller; synced Set is mutated
// in-place. Returns { added, closedCount, corrected }.
function applyImportedTrades(tradesArray, openTrades, closeTrades, synced) {
  let added = 0, closedCount = 0, corrected = 0;

  for (const t of openTrades) {
    if (t.txHash && synced.has(t.txHash)) continue;
    const trade = Object.assign({}, t);
    delete trade.isClose;
    tradesArray.push(trade);
    if (t.txHash) synced.add(t.txHash);
    added++;
  }

  for (const t of closeTrades) {
    if (t.txHash && synced.has(t.txHash)) continue;
    if (applyCloseTrade(tradesArray, t)) closedCount++;
    if (t.txHash) synced.add(t.txHash);
  }

  // Correct any OPEN trade whose expiry date is now in the past — covers
  // pre-existing stale trades as well as newly added ones.
  const todayStr = new Date().toISOString().split('T')[0];
  for (const t of tradesArray) {
    if (t.outcome === 'OPEN' && t.expiry && t.expiry < todayStr) {
      t.outcome = 'EXPIRED';
      corrected++;
    }
  }

  return { added, closedCount, corrected };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyCloseTrade, applyImportedTrades };
}
