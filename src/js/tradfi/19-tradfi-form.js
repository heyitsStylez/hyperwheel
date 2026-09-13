// ── TRADFI MANUAL ENTRY (Wheeler) ─────────────────────────
// Wheeler's ticker is free-text — arbitrary underlyings, no registry (#81).
// setTicker mirrors the typed symbol into sAsset (uppercased). wheelerAddTrade
// builds a HOLDING / PUT / CALL trade from the manual form and routes it through
// the same save()/render() path HyperWheel uses.
function setTicker(v) {
  sAsset = (v || '').trim().toUpperCase();
  // A futures ticker (e.g. MES) flips a holding's size unit to contracts, so the
  // label must track the ticker, not just the type toggle.
  refreshSizeLabel(sType === 'HOLDING');
  refreshLotPicker();
}

// Recently-traded tickers, most-recent-first, deduped. Backs the quick-pick
// chips above the ticker input so the common case is one tap.
function recentTickers(n) {
  const seen = new Set();
  const out = [];
  [...trades].sort((a, b) => b.id - a.id).forEach(t => {
    const a = (t.asset || '').toUpperCase();
    if (a && !seen.has(a)) { seen.add(a); out.push(a); }
  });
  return out.slice(0, n || 5);
}

// Populate the quick-pick chip row in the add-trade drawer. Hidden when empty.
function renderRecentTickers() {
  const box = document.getElementById('recent-tickers');
  if (!box) return;
  const tk = recentTickers(5);
  box.innerHTML = tk.map(a =>
    '<button type="button" class="ticker-chip" onclick="pickTicker(\'' + a + '\')">' + a + '</button>'
  ).join('');
  box.style.display = tk.length ? 'flex' : 'none';
}

// Chip click: fill the ticker input and mirror it into sAsset via setTicker.
function pickTicker(a) {
  const inp = document.getElementById('f-ticker');
  if (inp) inp.value = a;
  setTicker(a);
}

// Contracts↔shares display toggle (Wheeler). Flips how stored `size` (always
// shares) is rendered across tables and cards; no effect on stored data.
function setSizeDisplay(unit) {
  sSizeDisplay = unit;
  ['contracts', 'shares'].forEach(u => {
    const btn = document.getElementById('sd-' + u);
    if (btn) btn.classList.toggle('active', u === unit);
  });
  render();
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
    // Equity holdings are entered in raw shares; futures holdings in contracts
    // (×multiplier) so they line up with assigned-put lots.
    const storedSize = size * entryMultiplier(asset, true);
    tradeObj = { id, asset, type: 'HOLDING', date, expiry: '', dte: null, strike, size: storedSize, premium: 0, outcome: 'OPEN', closeCost: 0, closeDate: '', platform: 'MANUAL' };
  } else {
    const expiry  = g('f-expiry');
    const dte     = parseInt(g('f-dte')) || null;
    const premium = parseFloat(g('f-prem')) || 0;
    // Buy-to-close: the amount paid to close the option early, netted off the
    // premium received. Only meaningful for the CLOSED outcome.
    const closeCost = sOut === 'CLOSED' ? (parseFloat(g('f-closecost')) || 0) : 0;
    // Realisation date for buy-to-close (defaults to today via setOut).
    const closeDate = sOut === 'CLOSED' ? g('f-closedate') : '';
    if (!expiry) return err('Expiry required.');
    // Options are entered in contracts; store shares so the lot engine (shares)
    // lines up with holdings entered as raw share counts.
    tradeObj = { id, asset, type: sType, date, expiry, dte, strike, size: contractsToShares(size, asset), premium, outcome: sOut, closeCost, closeDate, platform: 'MANUAL' };
  }

  trades.push(tradeObj);
  save(); render();
  fetchExpiryPrices();  // price any newly-added ticker without a page reload
  clearForm();
  closeTradeDrawer();
  toast(asset + ' ' + sType.toLowerCase() + ' added');
  const tlog = document.getElementById('tlog');
  if (tlog) tlog.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
