// ── BOOT ──────────────────────────────────────────────
(function init() {
  // Load all persisted trades from localStorage
  try {
    trades = JSON.parse(localStorage.getItem(HW_HOLDINGS_KEY) || '[]');
  } catch (e) {
    trades = [];
  }

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
