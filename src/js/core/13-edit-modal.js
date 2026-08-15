// ── EDIT TRADE MODAL ─────────────────────────────────────────

let _editId = null;

function openEditModal(id, presetOutcome) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  _editId = id;

  const isHolding = t.type === 'HOLDING';
  document.getElementById('edit-title').textContent = isHolding
    ? 'Edit Spot Holding — ' + t.asset
    : 'Edit ' + t.type + ' — ' + t.asset;

  const f = (id, label, type, value, extra) =>
    '<div class="field">'
    + '<label>' + label + '</label>'
    + '<input id="ef-' + id + '" type="' + type + '" value="' + (value ?? '') + '"' + (extra ? ' ' + extra : '') + '>'
    + '</div>';

  const sel = (id, label, options, value) =>
    '<div class="field">'
    + '<label>' + label + '</label>'
    + '<select id="ef-' + id + '">'
    + options.map(o => '<option value="' + o.v + '"' + (o.v === value ? ' selected' : '') + '>' + o.l + '</option>').join('')
    + '</select>'
    + '</div>';

  let html = '';
  if (isHolding) {
    html += f('date',   'Date Acquired', 'date',   t.date,   '');
    html += f('strike', 'Cost Basis ($)', 'number', t.strike, 'step="0.01" min="0"');
    html += f('size',   'Size (' + t.asset + ')', 'number', t.size, 'step="0.01" min="0"');
    html += '<div class="field" style="grid-column:1/-1"><label>Notes</label><input id="ef-notes" type="text" value="' + (t.notes || '') + '"></div>';
  } else {
    html += f('date',    'Date',         'date',   t.date,   '');
    html += f('expiry',  'Expiry',       'date',   t.expiry, '');
    html += f('dte',     'DTE',          'number', t.dte,    'step="1" min="0"');
    html += f('strike',  'Strike ($)',   'number', t.strike, 'step="0.01" min="0"');
    // Wheeler options are entered in contracts (×100 shares); show the stored
    // share count as contracts and convert back on save. Crypto stays in tokens.
    html += _isTradfi()
      ? f('size', 'Contracts', 'number', sharesToContracts(t.size), 'step="0.01" min="0"')
      : f('size', 'Size (' + t.asset + ')', 'number', t.size, 'step="0.01" min="0"');
    html += f('premium', 'Premium ($)',  'number', t.premium,'step="0.01" min="0"');
    const outcome = presetOutcome || t.outcome;
    html += sel('outcome', 'Outcome',
      Object.entries(OUTCOMES).map(([code, o]) => ({ v: code, l: o.title })),
      outcome);
    // Buy-to-close cost, netted off premium; only meaningful for CLOSED.
    html += '<div class="field" id="ef-closecost-field"><label>Close Cost ($)</label>'
      + '<input id="ef-closecost" type="number" value="' + (t.closeCost || '') + '" step="0.01" min="0"></div>';
    // Realisation date for buy-to-close; only meaningful for CLOSED.
    html += '<div class="field" id="ef-closedate-field"><label>Close Date</label>'
      + '<input id="ef-closedate" type="date" value="' + (t.closeDate || '') + '"></div>';
    html += '<div class="field" style="grid-column:1/-1"><label>Notes</label><input id="ef-notes" type="text" value="' + (t.notes || '') + '"></div>';
  }

  document.getElementById('edit-fields').innerHTML = html;
  document.getElementById('edit-err').textContent = '';

  const outSel = document.getElementById('ef-outcome');
  if (outSel) { outSel.addEventListener('change', toggleEditCloseCost); toggleEditCloseCost(); }

  document.getElementById('edit-overlay').classList.add('open');
}

// Show the Close Cost field only when the selected outcome is CLOSED.
function toggleEditCloseCost() {
  const sel = document.getElementById('ef-outcome');
  const show = !!sel && sel.value === 'CLOSED';
  const ccField = document.getElementById('ef-closecost-field');
  const cdField = document.getElementById('ef-closedate-field');
  if (ccField) ccField.style.display = show ? '' : 'none';
  if (cdField) cdField.style.display = show ? '' : 'none';
  const cd = document.getElementById('ef-closedate');
  if (show && cd && !cd.value) cd.value = today();
}

function closeEditModal() {
  document.getElementById('edit-overlay').classList.remove('open');
  _editId = null;
}

function saveEdit() {
  const t = trades.find(t => t.id === _editId);
  if (!t) { closeEditModal(); return; }
  const err = document.getElementById('edit-err');
  err.textContent = '';

  const isHolding = t.type === 'HOLDING';
  const get = id => document.getElementById('ef-' + id);

  const date = get('date').value.trim();
  if (!date) { err.textContent = 'Date is required.'; return; }

  const strike = parseFloat(get('strike').value);
  const size   = parseFloat(get('size').value);
  if (isNaN(strike) || strike <= 0) { err.textContent = isHolding ? 'Cost basis must be > 0.' : 'Strike must be > 0.'; return; }
  if (isNaN(size)   || size   <= 0) { err.textContent = 'Size must be > 0.'; return; }

  t.date   = date;
  t.strike = strike;
  // Wheeler options edit in contracts; store shares. Holdings/crypto are raw.
  t.size   = (_isTradfi() && !isHolding) ? contractsToShares(size) : size;
  t.notes  = get('notes').value.trim();

  if (!isHolding) {
    t.expiry  = get('expiry').value.trim();
    const dte = parseInt(get('dte').value);
    t.dte     = isNaN(dte) ? null : dte;
    const prem = parseFloat(get('premium').value);
    t.premium  = isNaN(prem) ? 0 : prem;
    t.outcome  = get('outcome').value;
    if (t.outcome === 'CLOSED') {
      const cc = parseFloat(get('closecost').value);
      t.closeCost = isNaN(cc) ? 0 : cc;
      t.closeDate = get('closedate').value.trim();
    } else {
      t.closeCost = 0;
      t.closeDate = '';
    }
  }

  save();
  render();
  closeEditModal();
  toast('Saved changes to ' + t.asset + ' ' + (isHolding ? 'holding' : t.type));
}

document.addEventListener('DOMContentLoaded', function() {
  const el = document.getElementById('edit-overlay');
  if (el) el.addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
  });
});
