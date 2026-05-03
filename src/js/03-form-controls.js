// ── FORM CONTROLS

// renderFormDOM(draft) updates only the drawer DOM from the provided draft object
function renderFormDOM(d) {
  const assetVars = {
    BTC:  { c: 'var(--btc)',  b: 'var(--btcb)',  bg: 'var(--btcd)',  placeholder: '75000' },
    ETH:  { c: 'var(--eth)',  b: 'var(--ethb)',  bg: 'var(--ethd)',  placeholder: '3200'  },
    HYPE: { c: 'var(--hype)', b: 'var(--hypeb)', bg: 'var(--hyped)', placeholder: '25'    },
    SOL:  { c: 'var(--sol)',  b: 'var(--solb)',  bg: 'var(--sold)',  placeholder: '180'   },
  };
  const baseStyle = 'flex:1;padding:8px 4px;border-radius:6px;font-family:var(--sans);font-size:.72rem;font-weight:700;cursor:pointer;transition:all .15s;text-align:center;border:1px solid';
  ['BTC','ETH','HYPE','SOL'].forEach(x => {
    const btn = document.getElementById('ab-' + x);
    if (!btn) return;
    if (x === d.asset) {
      const v = assetVars[x];
      btn.style.cssText = `${baseStyle} ${v.b};color:${v.c};background:${v.bg}`;
    } else {
      btn.style.cssText = `${baseStyle} var(--bd2);color:var(--mu);background:transparent`;
    }
  });

  // size field and hint
  const sizeEl = document.getElementById('f-size');
  if (sizeEl) sizeEl.value = d.size || (d.platform === 'HSFC' ? '' : MIN_SIZE[d.asset]);
  const sizeHintEl = document.getElementById('f-size-hint');
  if (sizeHintEl) sizeHintEl.textContent = d.platform === 'HSFC' ? '' : 'min ' + MIN_SIZE[d.asset] + ' ' + d.asset;

  const strikeInp = document.getElementById('f-strike');
  if (strikeInp) strikeInp.placeholder = assetVars[d.asset]?.placeholder || '100';

  // type toggle appearance and conditional fields
  ['PUT','CALL','HOLDING'].forEach(x => { const btn = document.getElementById('tog-'+x); if (btn) btn.classList.toggle('active', x===d.type); });
  const isHolding = d.type === 'HOLDING';
  ['field-expiry','field-dte','field-platform','field-premium','field-outcome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isHolding ? 'none' : '';
  });
  const strikeLbl = document.getElementById('f-strike-lbl');
  if (strikeLbl) strikeLbl.textContent = isHolding ? 'Cost Basis ($)' : 'Strike ($)';
  const hint = document.getElementById('holding-hint'); if (hint) hint.style.display = isHolding ? 'block' : 'none';
  if (isHolding) {
    const premEl = document.getElementById('f-prem'); if (premEl) premEl.value = '0';
    if (sizeEl) sizeEl.value = '';
  } else {
    const premEl = document.getElementById('f-prem'); if (premEl && premEl.value === '0') premEl.value = '';
    if (sizeEl && !sizeEl.value) sizeEl.value = MIN_SIZE[d.asset];
  }

  // platform toggle
  ['RYSK','HSFC'].forEach(x => { const btn = document.getElementById('tog-'+x); if (btn) btn.classList.toggle('active', x===d.platform); });
  Object.entries(OUTCOMES).forEach(([code, o]) => {
    const btn = document.getElementById('tog-' + code);
    if (btn) btn.style.display = o.platforms.includes(d.platform) ? '' : 'none';
  });
  // size unit toggle visibility
  const tog = document.getElementById('field-size-unit-toggle');
  if (tog) tog.style.display = (d.platform === 'HSFC' && d.type === 'PUT') ? 'inline-flex' : 'none';
  ['contracts','usdc'].forEach(u => { const btn = document.getElementById('szu-' + u); if (btn) btn.classList.toggle('active', u === d.sizeUnit); });
  const sizeElPlaceholder = document.getElementById('f-size');
  const sizeHint = document.getElementById('f-size-hint');
  if (d.sizeUnit === 'usdc') { if (sizeElPlaceholder) { sizeElPlaceholder.placeholder = '3400'; sizeElPlaceholder.value = d.size || ''; } if (sizeHint) sizeHint.textContent = 'USDC collateral'; }
  else { if (sizeElPlaceholder) { sizeElPlaceholder.placeholder = ''; if (!d.size) sizeElPlaceholder.value = ''; } if (sizeHint) sizeHint.textContent = ''; }

  // outcome toggles
  Object.keys(OUTCOMES).forEach(x => { const btn = document.getElementById('tog-'+x); if (btn) btn.classList.toggle('active', x===d.outcome); });
  const ccField = document.getElementById('field-closecost'); if (ccField) ccField.style.display = (d.outcome === 'CLOSED') ? '' : 'none';

  // fill simple inputs
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
  setVal('f-date', d.date || ''); setVal('f-expiry', d.expiry || ''); setVal('f-dte', d.dte || ''); setVal('f-strike', d.strike || ''); setVal('f-prem', d.premium == null ? '' : d.premium);
  const notesEl = document.getElementById('f-notes'); if (notesEl) notesEl.value = d.notes || '';

  // refresh lot picker using draft asset/type
  refreshLotPickerFromDraft(d);
}

// Form setters now mutate the TradeDraft and call renderForm (so no full render())
function setAsset(a) { TradeDraft.setAsset(a); }
function setType(t)  { TradeDraft.setType(t); }
function setPlatform(p) { TradeDraft.setPlatform(p); }
function setSizeUnit(unit) { TradeDraft.setSizeUnit(unit); }
function setOut(o)   { TradeDraft.setOut(o); }

// Lot picker & autofill adapted to draft
function refreshLotPickerFromDraft(d) {
  const row = document.getElementById('field-lot-row');
  const sel = document.getElementById('f-lot');
  if (!row || !sel) return;
  if (d.type !== 'CALL') { row.style.display = 'none'; return; }
  const { lots } = compute();
  const openLots = (lots[d.asset] || []).filter(l => l.open);
  if (openLots.length < 2) { row.style.display = 'none'; return; }
  sel.innerHTML = openLots.map(l =>
    '<option value="' + l.lotNum + '">Lot ' + l.lotNum +  ' ' + l.size + ' ' + d.asset + ' @ $' + fmt(l.costBasis) + '</option>'
  ).join('');
  row.style.display = '';
  // if draft has lotNum, select it
  if (d.lotNum) {
    sel.value = d.lotNum;
  }
  // auto-fill using draft context
  autoFillFromLotDraft(d);
}

function autoFillFromLotDraft(d) {
  if (d.type !== 'CALL') return;
  if (d.outcome !== 'EXPIRED' && d.outcome !== 'CALLED') return;
  const lotRow = document.getElementById('field-lot-row');
  const pickerVisible = lotRow && lotRow.style.display !== 'none';
  const lotNum = pickerVisible ? (parseInt(document.getElementById('f-lot').value) || null) : null;

  let candidates = trades.filter(t => t.asset === d.asset && t.type === 'CALL');
  if (lotNum !== null) {
    const withLot = candidates.filter(t => t.lotNum === lotNum);
    if (withLot.length) candidates = withLot;
  }
  candidates.sort((a,b) => b.id - a.id);
  if (!candidates.length) return;
  const prev = candidates[0];
  const strikeEl = document.getElementById('f-strike');
  const sizeEl   = document.getElementById('f-size');
  const premEl   = document.getElementById('f-prem');
  if (strikeEl) strikeEl.value = prev.strike;
  if (sizeEl)   sizeEl.value   = prev.size;
  if (premEl && !premEl.readOnly) premEl.value = '0';
}

// Filters (unchanged behaviour: continue to trigger full render)
function setFilter(f) {
  sFilter = f;
  ['ALL','BTC','ETH','HYPE','SOL'].forEach(x => { const el = document.getElementById('fb-'+x); if(el) el.classList.toggle('active', x===f); });
  render();
}

function setPpnlTab(t) {
  sPpnlTab = t;
  ['total','monthly'].forEach(x => { const el = document.getElementById('ppnl-tab-'+x); if(el) el.classList.toggle('active', x===t); });
  render();
}
function autoDTE() {
  // uses DOM values (date/expiry) directly
  const d = document.getElementById('f-date').value;
  const e = document.getElementById('f-expiry').value;
  if (d && e) {
    const n = Math.round((new Date(e) - new Date(d)) / 86400000);
    document.getElementById('f-dte').value = n > 0 ? n : '';
  }
}

// History filters (unchanged)
function setHistOutcome(o) {
  sHistOutcome = o;
  ['ALL', ...Object.keys(OUTCOMES).filter(k => OUTCOMES[k].terminal)].forEach(x => {
    const el = document.getElementById('ho-' + x);
    if (el) el.classList.toggle('active', x === o);
  });
  render();
}
function setHistFrom(v) { sHistFrom = v; render(); }
function setHistTo(v)   { sHistTo   = v; render(); }
function clearHistFilters() {
  sHistOutcome = 'ALL'; sHistFrom = ''; sHistTo = '';
  const f = document.getElementById('hist-from'); if (f) f.value = '';
  const t = document.getElementById('hist-to');   if (t) t.value = '';
  ['ALL', ...Object.keys(OUTCOMES).filter(k => OUTCOMES[k].terminal)].forEach(x => {
    const el = document.getElementById('ho-' + x);
    if (el) el.classList.toggle('active', x === 'ALL');
  });
  render();
}
