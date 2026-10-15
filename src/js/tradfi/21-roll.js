// ── ROLL AN OPTION (Wheeler) ─────────────────────────────────
// Rolling = buy-to-close the open PUT/CALL and sell a replacement (usually a
// later expiry, maybe a new strike) in one step. Modelled as two ordinary
// trades so the lot engine / P&L need no changes: the old leg becomes CLOSED
// (closeCost = buy-back, closeDate = roll date) and a new OPEN leg of the same
// asset/type/platform/lotNum is added, carrying `rolledFrom: <old id>`.

// Pure: returns a new trades array with the roll applied, or null if `id` is
// not an open option. `size` is stored units (shares), like trade.size.
function rollTrade(trades, id, p) {
  const old = trades.find(t => t.id === id);
  if (!old || old.type === 'HOLDING' || old.outcome !== 'OPEN') return null;
  const newId = Math.max(Date.now(), ...trades.map(t => t.id + 1));
  const dte = Math.round((new Date(p.expiry) - new Date(p.date)) / 86400000);
  const closed = { ...old, outcome: 'CLOSED', closeCost: p.closeCost, closeDate: p.date };
  const next = {
    id: newId, asset: old.asset, type: old.type, date: p.date, expiry: p.expiry,
    dte: dte > 0 ? dte : null, strike: p.strike, size: p.size, premium: p.premium,
    outcome: 'OPEN', closeCost: 0, closeDate: '', platform: old.platform,
    rolledFrom: old.id,
  };
  if (old.lotNum != null) next.lotNum = old.lotNum;
  return trades.map(t => (t.id === id ? closed : t)).concat(next);
}

let _rollId = null;

function openRollModal(id) {
  const t = trades.find(t => t.id === id);
  if (!t) return;
  _rollId = id;
  document.getElementById('roll-title').textContent = 'Roll ' + t.type + ' — ' + t.asset;
  document.getElementById('roll-cur').textContent =
    'Current: $' + fmt(t.strike) + ' ' + t.type + ' exp ' + t.expiry
    + ' · ' + fmt(sharesToContracts(t.size, t.asset)) + ' contracts · +$' + fmt(t.premium) + ' premium';
  const set = (k, v) => { document.getElementById('rf-' + k).value = v; };
  set('closecost', '');
  set('date', today());
  set('expiry', '');
  set('strike', t.strike);
  set('size', sharesToContracts(t.size, t.asset));
  set('premium', '');
  document.getElementById('roll-err').textContent = '';
  rollRecalc();
  document.getElementById('roll-overlay').classList.add('open');
}

function closeRollModal() {
  document.getElementById('roll-overlay').classList.remove('open');
  _rollId = null;
}

// Live net credit/debit of the roll: new premium − buy-back cost.
function rollRecalc() {
  const cc = parseFloat(document.getElementById('rf-closecost').value) || 0;
  const pr = parseFloat(document.getElementById('rf-premium').value) || 0;
  const net = pr - cc;
  const el = document.getElementById('roll-net');
  el.textContent = (net >= 0 ? 'Net credit +$' : 'Net debit −$') + fmt(Math.abs(net));
  el.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
}

function confirmRoll() {
  const t = trades.find(t => t.id === _rollId);
  if (!t) { closeRollModal(); return; }
  const err = document.getElementById('roll-err');
  const v = k => document.getElementById('rf-' + k).value.trim();
  const closeCost = parseFloat(v('closecost'));
  const date = v('date'), expiry = v('expiry');
  const strike = parseFloat(v('strike'));
  const size = parseFloat(v('size'));
  const premium = parseFloat(v('premium'));
  if (isNaN(closeCost) || closeCost < 0) { err.textContent = 'Buy-back cost required.'; return; }
  if (!date) { err.textContent = 'Roll date required.'; return; }
  if (!expiry || expiry <= date) { err.textContent = 'New expiry must be after the roll date.'; return; }
  if (isNaN(strike) || strike <= 0) { err.textContent = 'Strike must be > 0.'; return; }
  if (isNaN(size) || size <= 0) { err.textContent = 'Contracts must be > 0.'; return; }
  if (isNaN(premium) || premium < 0) { err.textContent = 'New premium required.'; return; }

  const next = rollTrade(trades, t.id,
    { closeCost, date, expiry, strike, size: contractsToShares(size, t.asset), premium });
  if (!next) { err.textContent = 'Only open options can be rolled.'; return; }
  trades = next;
  save(); render();
  fetchExpiryPrices();
  closeRollModal();
  toast(t.asset + ' ' + t.type.toLowerCase() + ' rolled to $' + fmt(strike) + ' ' + expiry);
}

// Close on Esc / click outside (element ships to both apps, only wired on Wheeler).
(function () {
  if (typeof document === 'undefined') return;
  const ov = document.getElementById('roll-overlay');
  if (!ov) return;
  ov.addEventListener('click', function (e) { if (e.target === ov) closeRollModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ov.classList.contains('open')) closeRollModal();
  });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { rollTrade };
