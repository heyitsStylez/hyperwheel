// ── LOT NET COST HELPERS ─────────────────────────────────────

function lotNetCost(lotSize, lotCostBasis, lotPremiums) {
  // size === 0 guard returns null
  if (!lotSize || lotSize === 0) return null;
  return lotCostBasis - (lotPremiums / lotSize);
}

// Node export for tests
if (typeof module !== 'undefined') module.exports = { lotNetCost };
