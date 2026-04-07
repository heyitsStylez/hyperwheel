// Close modals on Escape
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('edit-overlay').classList.contains('open')) { closeEditModal(); return; }
  if (document.getElementById('trade-drawer').classList.contains('open')) { closeTradeDrawer(); return; }
});
