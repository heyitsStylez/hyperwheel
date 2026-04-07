// ── ADD TRADE
function addTrade() {
  const errEl = document.getElementById('ferr');
  errEl.style.display = 'none';
  const g = id => document.getElementById(id).value;
  const date = g('f-date'), expiry = g('f-expiry');
  const strike = parseFloat(g('f-strike')), size = parseFloat(g('f-size'));
  const prem = parseFloat(g('f-prem')), dte = parseInt(g('f-dte'));
  const notes = g('f-notes').trim();
  function err(m) { errEl.textContent = '⚠ ' + m; errEl.style.display = 'block'; }
  if (!date)   return err('Open date required.');
  if (sType !== 'HOLDING' && !expiry) return err('Expiry date required.');
  if (!strike || strike <= 0) return err(sType === 'HOLDING' ? 'Cost basis required.' : 'Strike price required.');
  if (!size || size <= 0)     return err('Size required.');
  if (sPlatform === 'RYSK' && size < MIN_SIZE[sAsset]) return err('Minimum size for ' + sAsset + ' is ' + MIN_SIZE[sAsset] + '.');
  if (sType !== 'HOLDING' && (isNaN(prem) || prem < 0)) return err('Premium required (enter 0 if none).');
  const lotRow = document.getElementById('field-lot-row');
  const lotNumVal = (sType === 'CALL' && lotRow && lotRow.style.display !== 'none')
    ? (parseInt(document.getElementById('f-lot').value) || null)
    : null;
  const closeCost = parseFloat(document.getElementById('f-closecost').value) || 0;
  if (sOut === 'CLOSED' && closeCost < 0) return err('Close cost cannot be negative.');
  // If size was entered in USDC, convert to token count
  let finalSize = size;
  if (sSizeUnit === 'usdc') {
    if (!strike || strike <= 0) return err('Strike required to convert USDC size to token count.');
    finalSize = size / strike;
  }
  const tradeObj = { id: Date.now(), asset: sAsset, type: sType, date, expiry, dte: isNaN(dte)?null:dte, strike, size: finalSize, premium: prem, outcome: sOut, notes, platform: sPlatform };
  if (sOut === 'CLOSED') tradeObj.closeCost = closeCost;
  if (lotNumVal !== null) tradeObj.lotNum = lotNumVal;
  trades.push(tradeObj);
  save(); render(); clearForm();
  closeTradeDrawer();
  document.getElementById('tlog').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearForm() {
  ['f-expiry','f-strike','f-notes','f-dte','f-closecost'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-prem').value = '';
  document.getElementById('f-prem').style.opacity = '1';
  document.getElementById('f-prem').readOnly = false;
  document.getElementById('f-size').value = MIN_SIZE[sAsset];
  setOut('OPEN');
  // Reset to PUT if was on HOLDING
  if (sType === 'HOLDING') setType('PUT');
  document.getElementById('ferr').style.display = 'none';
  const hint = document.getElementById('holding-hint');
  if (hint) hint.style.display = 'none';
  const ccField = document.getElementById('field-closecost');
  if (ccField) ccField.style.display = 'none';
}

function deleteTrade(id) { trades = trades.filter(t => t.id !== id); save(); render(); }
function quickOutcome(id, outcome) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  t.outcome = outcome;
  save(); render();
}
