// ── BOOT
(function init() {
  try { trades = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { trades = []; }
  // Migrate: ensure all trades have a platform field
  trades.forEach(t => { if (!t.platform) t.platform = 'RYSK'; });
  document.getElementById('f-date').value = today();
  document.getElementById('f-date').addEventListener('change', autoDTE);
  document.getElementById('f-expiry').addEventListener('change', autoDTE);
  render();
  fetchExpiryPrices();
})();
