// ── BOOT ──────────────────────────────────────────────
// bootReady resolves once trades are loaded and the first render has run.
// Tests await it; the browser ignores it.
var bootReady = (async function init() {
  // Load all persisted trades through the persistence seam
  trades = await loadTrades();

  // Migration: if hw_synced_v1 has entries but no chain-synced trades were
  // persisted (old save() bug only kept HOLDINGs), the synced set is stale.
  // Clear it so autoLoadChain re-imports everything on this session.
  try {
    const synced = JSON.parse(localStorage.getItem(HW_SYNCED_KEY) || '[]');
    const hasChainTrades = trades.some(t => t.txHash);
    if (synced.length > 0 && !hasChainTrades) {
      localStorage.removeItem(HW_SYNCED_KEY);
    }
  } catch (e) { /* ignore */ }

  document.getElementById('f-date').value = today();

  const wallet = loadWallet();
  if (!wallet) {
    showWalletPopup();
  } else {
    const fw = document.getElementById('footer-wallet');
    if (fw && wallet) fw.textContent = wallet.slice(0,6) + '...' + wallet.slice(-4);
    render();
    fetchExpiryPrices();
    cloudPull().then(() => autoLoadChain(wallet));
  }
})();
