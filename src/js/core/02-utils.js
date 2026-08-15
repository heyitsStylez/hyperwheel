function today() { return new Date().toISOString().split('T')[0]; }
function save() {
  persist(trades);
}
function fmt(n)  { return Number(n).toLocaleString('en', {maximumFractionDigits: 2, minimumFractionDigits: 0}); }
function sk(v)   { return Math.abs(v) >= 1000 ? (v/1000).toFixed(1).replace(/\.0$/,'')+'K' : fmt(v); }

// TradFi contract multiplier: one equity/ETF option contract controls 100
// shares. Wheeler enters options in contracts but stores shares, so the lot
// engine works purely in shares. This seam is the ONLY place the ×100 lives.
const SHARES_PER_CONTRACT = 100;
function contractsToShares(contracts) { return contracts * SHARES_PER_CONTRACT; }
function sharesToContracts(shares)    { return shares / SHARES_PER_CONTRACT; }
// % of collected premium kept when closing early (buy-to-close). A real wheel
// decision metric — 91% means you locked in 91% of the max premium. Returns
// null when there is no premium to capture (HOLDING / edge cases) so callers
// can hide the badge rather than divide by zero.
function capturePct(premium, closeCost) {
  if (!premium) return null;
  return (premium - (closeCost || 0)) / premium * 100;
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
  module.exports = { today, fmt, sk, SHARES_PER_CONTRACT, contractsToShares, sharesToContracts, capturePct };
}
