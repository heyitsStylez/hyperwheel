// ── WALLET POPUP (first visit) ─────────────────────────
function showWalletPopup() {
  const ov = document.getElementById('wallet-overlay');
  const inp = document.getElementById('wp-wallet-input');
  const btn = document.getElementById('wp-enter-btn');
  const saved = loadWallet();
  inp.value = saved;
  btn.disabled = !saved.startsWith('0x');
  document.getElementById('wp-status').innerHTML = '<span class="wp-cursor"></span>awaiting input...';
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
  if (!saved) inp.focus();
}

function hideWalletPopup() {
  const ov = document.getElementById('wallet-overlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 180);
}

function submitWalletPopup() {
  const address = (document.getElementById('wp-wallet-input').value || '').trim();
  if (!address.startsWith('0x') || address.length < 10) return;
  saveWallet(address);
  document.getElementById('wp-status').innerHTML = '<span class="wp-cursor"></span>loading positions...';
  setTimeout(() => {
    hideWalletPopup();
    render();
    fetchExpiryPrices();
    autoLoadChain(address);
  }, 300);
}
