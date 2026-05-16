function calcPremiumStats(rows) {
  let totalPrem = 0, totalNotional = 0, totalCount = 0;
  let otmCount = 0, itmCount = 0, openCount = 0;
  let aprWeightedSum = 0, aprWeightTotal = 0;

  rows.forEach(r => {
    if (r.type === 'HOLDING') return;
    const net = (r.premium || 0) - (r.closeCost || 0);
    const notional = (r.strike || 0) * (r.size || 0);
    totalPrem += net;
    totalNotional += notional;
    totalCount++;
    if (r.outcome === 'OPEN') { openCount++; }
    else if (r.outcome === 'EXPIRED') { otmCount++; }
    else if (r.outcome === 'ASSIGNED' || r.outcome === 'CALLED') { itmCount++; }
    if (r.annual != null) {
      aprWeightedSum += r.annual * notional;
      aprWeightTotal += notional;
    }
  });

  const settled = otmCount + itmCount;
  const returnRate = settled > 0 ? otmCount / settled * 100 : null;
  const portfolioAPR = aprWeightTotal > 0 ? aprWeightedSum / aprWeightTotal : null;

  return { totalPrem, totalNotional, totalCount, otmCount, itmCount, openCount, settled, returnRate, portfolioAPR };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcPremiumStats };
}
