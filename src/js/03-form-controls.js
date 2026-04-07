// ── FORM CONTROLS
function setAsset(a) {
  sAsset = a;
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
    if (x === a) {
      const v = assetVars[x];
      btn.style.cssText = `${baseStyle} ${v.b};color:${v.c};background:${v.bg}`;
    } else {
      btn.style.cssText = `${baseStyle} var(--bd2);color:var(--mu);background:transparent`;
    }
  });
  document.getElementById('f-size').value = sPlatform === 'HSFC' ? '' : MIN_SIZE[a];
  document.getElementById('f-size-hint').textContent = sPlatform === 'HSFC' ? '' : 'min ' + MIN_SIZE[a] + ' ' + a;
  document.getElementById('f-strike').placeholder = assetVars[a]?.placeholder || '100';
  refreshLotPicker();
}

function setType(t) {
  sType = t;
  ['PUT','CALL','HOLDING'].forEach(x => {
    const btn = document.getElementById('tog-'+x);
    if (!btn) return;
    btn.classList.toggle('active', x===t);
  });

  const isHolding = t === 'HOLDING';

  // Fully hide fields that don't apply to spot holding entries
  ['field-expiry','field-dte','field-platform','field-premium','field-outcome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isHolding ? 'none' : '';
  });

  // Update strike label and placeholder
  const strikeLbl = document.getElementById('f-strike-lbl');
  const strikeInp = document.getElementById('f-strike');
  if (strikeLbl) strikeLbl.textContent = isHolding ? 'Cost Basis ($)' : 'Strike ($)';
  if (strikeInp) strikeInp.placeholder = isHolding
    ? (sAsset === 'ETH' ? '3200' : '85000')
    : (sAsset === 'BTC' ? '75000' : '3200');

  // Show/hide hint
  const hint = document.getElementById('holding-hint');
  if (hint) hint.style.display = isHolding ? 'block' : 'none';

  // Hide size hint for holdings (no min size), show for options
  const sizeHintEl = document.getElementById('f-size-hint');
  if (sizeHintEl) sizeHintEl.style.display = isHolding ? 'none' : '';

  // If switching to holding, force premium to 0, clear size default, outcome to OPEN
  if (isHolding) {
    document.getElementById('f-prem').value = '0';
    document.getElementById('f-size').value = '';
    setOut('OPEN'); // internal state — compute() handles holding specially
  } else {
    if (document.getElementById('f-prem').value === '0') {
      document.getElementById('f-prem').value = '';
    }
    document.getElementById('f-size').value = MIN_SIZE[sAsset];
  }
  refreshLotPicker();
  refreshSizeUnitToggle();
  if (t !== 'PUT') setSizeUnit('contracts');
}
function setPlatform(p) {
  sPlatform = p;
  ['RYSK','HSFC'].forEach(x => {
    const btn = document.getElementById('tog-'+x);
    if (btn) btn.classList.toggle('active', x===p);
  });
  // CLOSED outcome only available on HSFC
  const closedBtn = document.getElementById('tog-CLOSED');
  if (closedBtn) closedBtn.style.display = (p === 'HSFC') ? '' : 'none';
  // If switching to RYSK while CLOSED is selected, reset to OPEN
  if (p === 'RYSK' && sOut === 'CLOSED') setOut('OPEN');
  // Update size hint and default
  const sizeHint = document.getElementById('f-size-hint');
  if (sizeHint) sizeHint.textContent = p === 'HSFC' ? '' : 'min ' + MIN_SIZE[sAsset] + ' ' + sAsset;
  const sizeEl = document.getElementById('f-size');
  if (sizeEl && !sizeEl.value) sizeEl.value = p === 'HSFC' ? '' : MIN_SIZE[sAsset];
  // Show/hide size unit toggle (only for HSFC puts)
  refreshSizeUnitToggle();
  // Reset to contracts when switching away from HSFC
  if (p !== 'HSFC') setSizeUnit('contracts');
}

function refreshSizeUnitToggle() {
  const tog = document.getElementById('field-size-unit-toggle');
  if (tog) tog.style.display = (sPlatform === 'HSFC' && sType === 'PUT') ? 'inline-flex' : 'none';
}

function setSizeUnit(unit) {
  sSizeUnit = unit;
  ['contracts','usdc'].forEach(u => {
    const btn = document.getElementById('szu-' + u);
    if (btn) btn.classList.toggle('active', u === unit);
  });
  const sizeEl = document.getElementById('f-size');
  const sizeHint = document.getElementById('f-size-hint');
  if (unit === 'usdc') {
    if (sizeEl) { sizeEl.placeholder = '3400'; sizeEl.value = ''; }
    if (sizeHint) sizeHint.textContent = 'USDC collateral';
  } else {
    if (sizeEl) { sizeEl.placeholder = ''; sizeEl.value = ''; }
    if (sizeHint) sizeHint.textContent = '';
  }
}
function setOut(o) {
  sOut = o;
  ['OPEN','EXPIRED','ASSIGNED','CALLED','CLOSED'].forEach(x => {
    const btn = document.getElementById('tog-'+x);
    if (btn) btn.classList.toggle('active', x===o);
  });
  // Show close cost field only when CLOSED
  const ccField = document.getElementById('field-closecost');
  if (ccField) ccField.style.display = (o === 'CLOSED') ? '' : 'none';
  autoFillFromLot();
}
function refreshLotPicker() {
  const row = document.getElementById('field-lot-row');
  const sel = document.getElementById('f-lot');
  if (!row || !sel) return;
  if (sType !== 'CALL') { row.style.display = 'none'; return; }
  const { lots } = compute();
  const openLots = (lots[sAsset] || []).filter(l => l.open);
  if (openLots.length < 2) { row.style.display = 'none'; return; }
  sel.innerHTML = openLots.map(l =>
    '<option value="' + l.lotNum + '">Lot ' + l.lotNum + ' \u2014 ' + l.size + ' ' + sAsset + ' @ $' + fmt(l.costBasis) + '</option>'
  ).join('');
  row.style.display = '';
  autoFillFromLot(); // auto-fill if outcome is already EXPIRED/CALLED
}
function autoFillFromLot() {
  // Only applies when logging an expiry or called-away event on a CALL
  if (sType !== 'CALL') return;
  if (sOut !== 'EXPIRED' && sOut !== 'CALLED') return;

  // Determine which lot's history to search
  const lotRow = document.getElementById('field-lot-row');
  const pickerVisible = lotRow && lotRow.style.display !== 'none';
  const lotNum = pickerVisible ? (parseInt(document.getElementById('f-lot').value) || null) : null;

  // Find the most recent CALL for this asset on the selected lot
  let candidates = trades.filter(t => t.asset === sAsset && t.type === 'CALL');
  if (lotNum !== null) {
    const withLot = candidates.filter(t => t.lotNum === lotNum);
    // Prefer explicit-lot matches; fall back to all asset calls for old trades without lotNum
    if (withLot.length) candidates = withLot;
  }
  candidates.sort((a, b) => b.id - a.id);
  if (!candidates.length) return;

  const prev = candidates[0];
  const strikeEl = document.getElementById('f-strike');
  const sizeEl   = document.getElementById('f-size');
  const premEl   = document.getElementById('f-prem');
  if (strikeEl) strikeEl.value = prev.strike;
  if (sizeEl)   sizeEl.value   = prev.size;
  // EXPIRED / CALLED = closing event; premium was already collected at OPEN, set to 0
  if (premEl && !premEl.readOnly) premEl.value = '0';
}
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
  const d = document.getElementById('f-date').value;
  const e = document.getElementById('f-expiry').value;
  if (d && e) {
    const n = Math.round((new Date(e) - new Date(d)) / 86400000);
    document.getElementById('f-dte').value = n > 0 ? n : '';
  }
}
