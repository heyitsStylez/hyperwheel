// Close trade drawer on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('trade-drawer').classList.contains('open')) {
    closeTradeDrawer();
  }
});
