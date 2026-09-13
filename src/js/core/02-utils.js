function today() { return new Date().toISOString().split('T')[0]; }
function save() {
  persist(trades);
}
function fmt(n)  { return Number(n).toLocaleString('en', {maximumFractionDigits: 2, minimumFractionDigits: 0}); }
function sk(v)   { return Math.abs(v) >= 1000 ? (v/1000).toFixed(1).replace(/\.0$/,'')+'K' : fmt(v); }

// TradFi contract multiplier seam. Wheeler enters options in contracts but
// stores shares (contracts × multiplier), so the lot engine works purely in
// shares. This is the ONLY place the ×N lives. The multiplier is per-asset
// (contractMultiplier): 100 for equities/ETFs, the point multiplier for futures
// (MES = 5). SHARES_PER_CONTRACT stays as the documented equity default.
const SHARES_PER_CONTRACT = 100;
function contractsToShares(contracts, asset) { return contracts * contractMultiplier(asset); }
function sharesToContracts(shares, asset)    { return shares / contractMultiplier(asset); }
// Multiplier applied to a Wheeler size-field entry before storing (always
// shares). Options are entered in contracts → ×multiplier. Holdings: equity/ETF
// holdings are entered in raw shares → ×1; futures holdings have no share
// concept, so they're entered in contracts too → ×multiplier. Inverse converts a
// stored size back to what the field should show.
function entryMultiplier(asset, isHolding) {
  return (isHolding && contractMultiplier(asset) === 100) ? 1 : contractMultiplier(asset);
}
// % of collected premium kept when closing early (buy-to-close). A real wheel
// decision metric — 91% means you locked in 91% of the max premium. Returns
// null when there is no premium to capture (HOLDING / edge cases) so callers
// can hide the badge rather than divide by zero.
function capturePct(premium, closeCost) {
  if (!premium) return null;
  return (premium - (closeCost || 0)) / premium * 100;
}
// Days left on the clock when a position was bought to close early
// (expiry − closeDate). Completes the close-vs-hold story next to capturePct:
// "kept 91% with 5 days early". Returns null when either date is missing.
function daysEarly(expiry, closeDate) {
  if (!expiry || !closeDate) return null;
  return Math.round((new Date(expiry + 'T00:00:00') - new Date(closeDate + 'T00:00:00')) / 86400000);
}
function loadWallet() {
  return localStorage.getItem(HW_WALLET_KEY) || '';
}
function saveWallet(addr) {
  localStorage.setItem(HW_WALLET_KEY, addr);
}

function toast(msg, kind) {
  const c = document.getElementById('toast-stack');
  if (!c) return;
  const k = kind || 'ok';
  const el = document.createElement('div');
  el.className = 'toast toast-' + k;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-in'));
  setTimeout(() => {
    el.classList.remove('toast-in');
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { today, fmt, sk, SHARES_PER_CONTRACT, contractsToShares, sharesToContracts, entryMultiplier, capturePct, daysEarly };
}
