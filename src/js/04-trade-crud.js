// ── ADD TRADE
function addTrade() {
  const errEl = document.getElementById('ferr');
  errEl.style.display = 'none';
  const d = TradeDraft.draft;
  function err(m) { errEl.textContent = '⚠ ' + m; errEl.style.display = 'block'; }
  if (!d.date)   return err('Purchase date required.');
  const strike = parseFloat(d.strike), size = parseFloat(d.size);
  if (!strike || strike <= 0) return err('Cost basis required.');
  if (!size || size <= 0)     return err('Size required.');
  const tradeObj = {
    id: Date.now(),
    asset: d.asset,
    type: d.type || 'HOLDING',
    date: d.date,
    expiry: d.expiry || '',
    dte: d.dte || null,
    strike: strike,
    size: size,
    premium: parseFloat(d.premium) || 0,
    outcome: d.outcome || 'OPEN',
    platform: d.platform || 'SPOT',
    lotNum: d.lotNum || null,
    txHash: '',
    notes: d.notes || ''
  };
  commitTrades(t => { t.push(tradeObj); });
  clearForm();
  closeTradeDrawer();
  toast(d.asset + ' holding added');
  const tlog = document.getElementById('tlog'); if (tlog) tlog.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearForm() {
  // reset draft and a few DOM fields
  if (typeof TradeDraft !== 'undefined' && TradeDraft.draft) TradeDraft.initFromGlobals ? TradeDraft.initFromGlobals() : TradeDraft.renderForm();
  ['f-strike','f-dte','f-closecost'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sizeEl = document.getElementById('f-size'); if (sizeEl) sizeEl.value = MIN_SIZE[(TradeDraft && TradeDraft.draft && TradeDraft.draft.asset) ? TradeDraft.draft.asset : sAsset];
  const ferr = document.getElementById('ferr'); if (ferr) ferr.style.display = 'none';
}

function deleteTrade(id) {
  const t = trades.find(t => t.id === id);
  commitTrades(ts => { return ts.filter(x => x.id !== id); });
  if (t) toast('Deleted ' + t.asset + ' ' + t.type);
}
function quickOutcome(id, outcome) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  commitTrades(ts => { const tt = ts.find(u => u.id === id); if (!tt) return; tt.outcome = outcome; });
  const title = OUTCOMES[outcome] && OUTCOMES[outcome].title;
  toast(t.asset + ' ' + t.type + ' marked ' + (title ? title.toLowerCase() : outcome.toLowerCase()));
}
