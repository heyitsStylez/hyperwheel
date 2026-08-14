// ── PNL CALCULATOR (cash-flow lens) ──────────────────────────
// Pure module. Realised P&L is settled-events only:
//   Σ(net premiums of all settled options)
//   + Σ over CALLED events of (strike − costBasis) × calledSize
// Open options and open lots contribute zero. CLOSED CALL with
// closeCost > premium contributes a negative netPrem cleanly.
//
// Slice 1: Realised path only. Unrealised + Total land in Slice 2.

function computePnl(trades, assetFilter, livePrices) {
  livePrices = livePrices || {};
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
  let unrealised = 0;
  const missingSpotAssets = [];
  const events = [];
  const realisedByMonth = {};

  Object.keys(byAsset).forEach(asset => {
    const assetTrades = byAsset[asset];
    const { lots } = engine(assetTrades);

    const openLots = lots.filter(l => !l.endDate && l.size > 0);
    if (openLots.length) {
      const spot = livePrices[asset];
      if (spot == null) {
        missingSpotAssets.push(asset);
      } else {
        openLots.forEach(l => {
          unrealised += (spot - l.costBasis) * l.size;
        });
      }
    }

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
      const evDate = t.expiry || t.date;
      events.push({ date: evDate, delta });
      const ym = (evDate || '').slice(0, 7);
      if (ym) realisedByMonth[ym] = (realisedByMonth[ym] || 0) + delta;
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

  const total = realised + unrealised;
  return { realised, unrealised, total, missingSpotAssets, realisedSeries, realisedByMonth };
}

function buildDisplaySeries(series, period, today) {
  if (!series.length) return [];

  const allSeries = [{ date: series[0].date, val: 0 }, ...series];

  let dispSeries;
  if (period === 'ALL') {
    dispSeries = allSeries;
  } else {
    const days = period === '1M' ? 30 : 90;
    const cutDate = new Date(today + 'T12:00:00');
    cutDate.setDate(cutDate.getDate() - days);
    const cutStr = cutDate.toISOString().slice(0, 10);

    const lastBefore = allSeries.filter(p => p.date < cutStr);
    const baseline = lastBefore.length ? lastBefore[lastBefore.length - 1].val : 0;
    const inPeriod = allSeries.filter(p => p.date >= cutStr);

    if (!inPeriod.length) {
      dispSeries = [{ date: cutStr, val: baseline }, { date: today, val: baseline }];
    } else {
      dispSeries = [{ date: cutStr, val: baseline }, ...inPeriod];
    }
  }

  const last = dispSeries[dispSeries.length - 1];
  if (last.date < today) {
    dispSeries = [...dispSeries, { date: today, val: last.val }];
  }

  return dispSeries;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computePnl, buildDisplaySeries };
}
