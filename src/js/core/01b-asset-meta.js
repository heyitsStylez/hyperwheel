// ── ASSET META (presentation) ────────────────────────────────
// Per-ticker colour + contract minimum, derived so arbitrary tickers work with
// no registry or config. Platform modules register brand overrides (e.g.
// crypto's BTC orange) into these tables; unknown tickers fall back to a stable
// symbol-hash colour and no contract minimum (TradFi has no per-asset minimum).
const ASSET_BRAND = {};     // sym -> hex; populated by platform modules
const ASSET_MIN_SIZE = {};  // sym -> min contract size

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASSET_BRAND, ASSET_MIN_SIZE, assetColor, minSize };
}
