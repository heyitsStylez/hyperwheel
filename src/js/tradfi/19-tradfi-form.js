// ── TRADFI MANUAL ENTRY (Wheeler) ─────────────────────────
// Wheeler's ticker is free-text — arbitrary underlyings, no registry (#81).
// setTicker mirrors the typed symbol into sAsset (uppercased). wheelerAddTrade
// builds a HOLDING / PUT / CALL trade from the manual form and routes it through
// the same save()/render() path HyperWheel uses.
function setTicker(v) {
  sAsset = (v || '').trim().toUpperCase();
  refreshLotPicker();
}

function wheelerAddTrade() {
  const errEl = document.getElementById('ferr');
  errEl.style.display = 'none';
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  function err(m) { errEl.textContent = '⚠ ' + m; errEl.style.display = 'block'; }

  const asset  = sAsset;
  const date   = g('f-date');
  const strike = parseFloat(g('f-strike'));
  const size   = parseFloat(g('f-size'));

  if (!asset) return err('Ticker required.');
  if (!date)  return err('Date required.');
  if (!strike || strike <= 0) return err(sType === 'HOLDING' ? 'Cost basis required.' : 'Strike required.');
  if (!size || size <= 0)     return err('Size required.');

  // Strictly-increasing id: Wheeler drives HOLDING then an option through the
  // same drawer in quick succession, so two Date.now() adds can land in the same
  // millisecond and collide — edit/delete key on id, so a dupe misroutes them.
  const id = Math.max(Date.now(), ...trades.map(t => t.id + 1));

  let tradeObj;
  if (sType === 'HOLDING') {
    tradeObj = { id, asset, type: 'HOLDING', date, expiry: '', dte: null, strike, size, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' };
  } else {
    const expiry  = g('f-expiry');
    const dte     = parseInt(g('f-dte')) || null;
    const premium = parseFloat(g('f-prem')) || 0;
    if (!expiry) return err('Expiry required.');
    tradeObj = { id, asset, type: sType, date, expiry, dte, strike, size, premium, outcome: sOut, closeCost: 0, platform: 'MANUAL' };
  }

  trades.push(tradeObj);
  save(); render(); clearForm();
  closeTradeDrawer();
  toast(asset + ' ' + sType.toLowerCase() + ' added');
  const tlog = document.getElementById('tlog');
  if (tlog) tlog.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
