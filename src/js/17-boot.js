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
    const fw = document.getElementById('footer-wallet');
    if (fw && wallet) fw.textContent = wallet.slice(0,6) + '...' + wallet.slice(-4);
    render();
    fetchExpiryPrices();
    autoLoadChain(wallet);
  }
})();
