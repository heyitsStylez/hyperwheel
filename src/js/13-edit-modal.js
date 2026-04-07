// ═══════════════════════════════════════════════════════════
// EDIT TRADE MODAL
// ═══════════════════════════════════════════════════════════

function openEditModal(id) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  editingId = id;

  document.getElementById('e-platform').value = t.platform || 'RYSK';
  document.getElementById('e-asset').value   = t.asset   || 'BTC';
  document.getElementById('e-type').value    = t.type    || 'PUT';
  document.getElementById('e-outcome').value = t.outcome || 'OPEN';
  document.getElementById('e-date').value    = t.date    || '';
  document.getElementById('e-expiry').value  = t.expiry  || '';
  document.getElementById('e-dte').value     = t.dte     || '';
  document.getElementById('e-strike').value  = t.strike  || '';
  document.getElementById('e-size').value    = t.size    || '';
  document.getElementById('e-premium').value = t.premium != null ? t.premium : '';
  document.getElementById('e-closecost').value = t.closeCost != null ? t.closeCost : '';
  document.getElementById('e-notes').value   = t.notes   || '';
  document.getElementById('e-err').style.display = 'none';

  onEditTypeChange(); // adjust field visibility for HOLDING
  onEditOutcomeChange(); // adjust close cost visibility
  onEditPlatformChange(); // adjust CLOSED option visibility
  const ov = document.getElementById('edit-overlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function closeEditModal() {
  const ov = document.getElementById('edit-overlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 180);
  editingId = null;
}

function onEditAssetChange() {
  // nothing needed — asset change doesn't affect field visibility
}

function onEditPlatformChange() {
  const plat = document.getElementById('e-platform').value;
  const outcomeEl = document.getElementById('e-outcome');
  const closedOpt = outcomeEl.querySelector('option[value="CLOSED"]');
  if (plat === 'RYSK') {
    if (closedOpt) closedOpt.style.display = 'none';
    if (outcomeEl.value === 'CLOSED') outcomeEl.value = 'OPEN';
  } else {
    if (closedOpt) closedOpt.style.display = '';
  }
  onEditOutcomeChange();
}

function onEditOutcomeChange() {
  const outcome = document.getElementById('e-outcome').value;
  const ccWrap = document.getElementById('e-closecost-wrap');
  if (ccWrap) ccWrap.style.display = (outcome === 'CLOSED') ? '' : 'none';
}

function onEditTypeChange() {
  const type = document.getElementById('e-type').value;
  const isHolding = type === 'HOLDING';
  document.getElementById('e-expiry-wrap').style.display  = isHolding ? 'none' : '';
  document.getElementById('e-dte-wrap').style.display     = isHolding ? 'none' : '';
  document.getElementById('e-premium-wrap').style.display = isHolding ? 'none' : '';
  document.getElementById('e-closecost-wrap').style.display = isHolding ? 'none' : '';
  document.getElementById('e-strike-label').textContent   = isHolding ? 'Cost Basis' : 'Strike';
}

function saveEdit() {
  const errEl = document.getElementById('e-err');
  errEl.style.display = 'none';

  function err(msg) {
    errEl.textContent = '⚠ ' + msg;
    errEl.style.display = 'block';
  }

  const platform  = document.getElementById('e-platform').value;
  const asset     = document.getElementById('e-asset').value;
  const type      = document.getElementById('e-type').value;
  const outcome   = document.getElementById('e-outcome').value;
  const date      = document.getElementById('e-date').value;
  const expiry    = document.getElementById('e-expiry').value;
  const dte       = parseInt(document.getElementById('e-dte').value);
  const strike    = parseFloat(document.getElementById('e-strike').value);
  const size      = parseFloat(document.getElementById('e-size').value);
  const premium   = parseFloat(document.getElementById('e-premium').value);
  const closeCost = parseFloat(document.getElementById('e-closecost').value) || 0;
  const notes     = document.getElementById('e-notes').value.trim();
  const isHolding = type === 'HOLDING';

  if (!date)                            return err('Open date required.');
  if (!isHolding && !expiry)            return err('Expiry date required.');
  if (!strike || strike <= 0)           return err(isHolding ? 'Cost basis required.' : 'Strike required.');
  if (!size || size <= 0)               return err('Size required.');
  if (platform === 'RYSK' && size < MIN_SIZE[asset]) return err('Minimum size for ' + asset + ' is ' + MIN_SIZE[asset] + '.');
  if (!isHolding && (isNaN(premium) || premium < 0)) return err('Premium required (enter 0 if none).');
  if (outcome === 'CLOSED' && closeCost < 0) return err('Close cost cannot be negative.');

  const idx = trades.findIndex(t => t.id === editingId);
  if (idx === -1) return err('Trade not found.');

  const updated = {
    ...trades[idx],
    platform, asset, type, outcome, date,
    expiry:  isHolding ? '' : expiry,
    dte:     isHolding ? null : (isNaN(dte) ? null : dte),
    strike, size,
    premium: isHolding ? 0 : (isNaN(premium) ? 0 : premium),
    notes,
  };
  if (outcome === 'CLOSED') updated.closeCost = closeCost;
  else delete updated.closeCost;
  trades[idx] = updated;

  save();
  render();
  closeEditModal();
}

// Close on overlay backdrop click
document.addEventListener('DOMContentLoaded', function() {
  const ov = document.getElementById('edit-overlay');
  if (ov) ov.addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
  });
});
