// ── ADD TRADE
function addTrade() {
  const errEl = document.getElementById('ferr');
  errEl.style.display = 'none';
  const g = id => document.getElementById(id).value;
  const date = g('f-date');
  const strike = parseFloat(g('f-strike')), size = parseFloat(g('f-size'));
  function err(m) { errEl.textContent = '⚠ ' + m; errEl.style.display = 'block'; }
  if (!date)   return err('Purchase date required.');
  if (!strike || strike <= 0) return err('Cost basis required.');
  if (!size || size <= 0)     return err('Size required.');
  const tradeObj = { id: Date.now(), asset: sAsset, type: 'HOLDING', date, expiry: '', dte: null, strike, size, premium: 0, outcome: 'OPEN', platform: 'SPOT' };
  trades.push(tradeObj);
  save(); render(); clearForm();
  closeTradeDrawer();
  toast(sAsset + ' holding added');
  document.getElementById('tlog').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearForm() {
  ['f-strike','f-dte','f-closecost'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-size').value = MIN_SIZE[sAsset];
  document.getElementById('ferr').style.display = 'none';
}

function deleteTrade(id) {
  const t = trades.find(t => t.id === id);
  trades = trades.filter(t => t.id !== id);
  save(); render();
  if (t) toast('Deleted ' + t.asset + ' ' + t.type);
}
function quickOutcome(id, outcome) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  t.outcome = outcome;
  save(); render();
  const labels = { EXPIRED: 'expired', ASSIGNED: 'assigned', CALLED: 'called away', CLOSED: 'closed early' };
  toast(t.asset + ' ' + t.type + ' marked ' + (labels[outcome] || outcome.toLowerCase()));
}
