function today() { return new Date().toISOString().split('T')[0]; }
function save() {
  const holdings = trades.filter(t => t.type === 'HOLDING');
  localStorage.setItem(HW_HOLDINGS_KEY, JSON.stringify(holdings));
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
