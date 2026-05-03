function today() { return new Date().toISOString().split('T')[0]; }
function save() {
  localStorage.setItem(HW_HOLDINGS_KEY, JSON.stringify(trades));
  if (typeof scheduleCloudPush === 'function') scheduleCloudPush();
}
function fmt(n)  { return Number(n).toLocaleString('en', {maximumFractionDigits: 2, minimumFractionDigits: 0}); }
function sk(v)   { return Math.abs(v) >= 1000 ? (v/1000).toFixed(1).replace(/\.0$/,'')+'K' : fmt(v); }
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
  module.exports = { today, fmt, sk };
}
