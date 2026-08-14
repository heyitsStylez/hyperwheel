// ── UTILS
function openTradeDrawer() {
  document.getElementById('trade-drawer').classList.add('open');
  document.getElementById('trade-drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('f-expiry').focus(), 350);
}

function closeTradeDrawer() {
  document.getElementById('trade-drawer').classList.remove('open');
  document.getElementById('trade-drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function focusForm() { openTradeDrawer(); }
