// ── ASSET META (presentation) ────────────────────────────────
// Per-ticker colour + contract minimum, derived so arbitrary tickers work with
// no registry or config. Platform modules register brand overrides (e.g.
// crypto's BTC orange) into these tables; unknown tickers fall back to a stable
// symbol-hash colour and no contract minimum (TradFi has no per-asset minimum).
const ASSET_BRAND = {};      // sym -> hex; populated by platform modules
const ASSET_MIN_SIZE = {};   // sym -> min contract size
const ASSET_MULTIPLIER = {}; // sym -> contract multiplier (TradFi); populated by
                             // platform modules. Equity/ETF options control 100
                             // shares; futures use their point multiplier
                             // (e.g. MES = $5/index-point). Default 100.

// Stable hash → HSL so a given ticker always renders the same colour.
function assetColor(sym) {
  if (ASSET_BRAND[sym]) return ASSET_BRAND[sym];
  const s = String(sym);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 55%)`;
}

function minSize(sym) {
  return ASSET_MIN_SIZE[sym] ?? 0;
}

// Contract multiplier for a TradFi ticker. Defaults to 100 (equity/ETF options
// control 100 shares); futures register their own (MES = 5). Crypto never calls
// this — the ×N seam is gated behind _isTradfi().
function contractMultiplier(sym) {
  return ASSET_MULTIPLIER[sym] ?? 100;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASSET_BRAND, ASSET_MIN_SIZE, ASSET_MULTIPLIER, assetColor, minSize, contractMultiplier };
}
