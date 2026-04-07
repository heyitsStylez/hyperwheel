// ── BOOT ──────────────────────────────────────────────
(function init() {
  // Load manually-entered HOLDING positions from localStorage
  try {
    trades = JSON.parse(localStorage.getItem(HW_HOLDINGS_KEY) || '[]');
  } catch (e) {
    trades = [];
  }

  document.getElementById('f-date').value = today();

  const wallet = loadWallet();
  if (!wallet) {
    showWalletPopup();
  } else {
    render();
    fetchExpiryPrices();
    autoLoadChain(wallet);
  }
})();
