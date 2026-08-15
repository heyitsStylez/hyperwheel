// Close modals on Escape
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('edit-overlay').classList.contains('open')) { closeEditModal(); return; }
  if (document.getElementById('trade-drawer').classList.contains('open')) { closeTradeDrawer(); return; }
});

// Enter submits the open trade drawer (from any text/number input; date inputs
// keep their native Enter behaviour). Clicks the drawer's single primary button
// so it routes to whichever add function the app wired up.
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const drawer = document.getElementById('trade-drawer');
  if (!drawer || !drawer.classList.contains('open')) return;
  const t = e.target;
  if (!t || t.tagName !== 'INPUT' || t.type === 'date') return;
  e.preventDefault();
  const btn = drawer.querySelector('.btn-p');
  if (btn) btn.click();
});

// Touch devices can't hover, so tap toggles the styled tooltips (P&L lens hints).
document.addEventListener('click', function(e) {
  if (!window.matchMedia || !window.matchMedia('(hover:none)').matches) return;
  const tip = e.target.closest ? e.target.closest('.has-tip') : null;
  document.querySelectorAll('.has-tip.tip-open').forEach(function(el) {
    if (el !== tip) el.classList.remove('tip-open');
  });
  if (tip) tip.classList.toggle('tip-open');
});
