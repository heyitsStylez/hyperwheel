// ── DITM CALL CALCULATOR (Wheeler) ───────────────────────────
// What-if model of a long deep-in-the-money call as a stock substitute
// (the "poor man's covered call" long leg). Mirrors sheet 1 of the
// ditm_call_tracker.xlsx. Pure scratchpad — nothing is saved to trades.

function openDitmCalc() {
  document.getElementById('ditm-overlay').classList.add('open');
  ditmRecalc();
}

function closeDitmCalc() {
  document.getElementById('ditm-overlay').classList.remove('open');
}

// Auto-generate a sorted, deduped set of price levels: total loss (0),
// current price (stock breakeven), strike, option breakeven, plus a spread
// of ± moves around the current price.
function ditmLevels(price, strike, optBe) {
  const set = [0, price, strike, optBe];
  [0.5, 0.75, 1.25, 1.5, 2, 2.5].forEach(m => set.push(price * m));
  const seen = new Set();
  return set
    .map(v => Math.round(v * 100) / 100)
    .filter(v => v >= 0 && (seen.has(v) ? false : seen.add(v)))
    .sort((a, b) => a - b);
}

function ditmRecalc() {
  const num = id => parseFloat(document.getElementById(id).value);
  const price = num('dc-price');
  const strike = num('dc-strike');
  const prem = num('dc-prem');
  const expiry = document.getElementById('dc-expiry').value;

  const tiles = document.getElementById('dc-tiles');
  const matrix = document.getElementById('dc-matrix');

  const ready = price > 0 && strike > 0 && prem > 0;
  if (!ready) {
    tiles.innerHTML = '';
    matrix.innerHTML = '<p style="font-size:.72rem;color:var(--mu2)">Fill in price, strike and premium to see the numbers.</p>';
    return;
  }

  const M = 100;                    // shares per contract (equity LEAPS)
  const shares100 = price * M;      // cost of 100 shares
  const debit = prem * M;           // cost of 1 call = max loss on the call
  const optBe = strike + prem;      // option breakeven
  const dte = expiry
    ? Math.round((new Date(expiry + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000)
    : null;

  const tile = (k, v, color) =>
    '<div class="dc-tile"><div class="k">' + k + '</div><div class="v"'
    + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div></div>';

  tiles.innerHTML =
    '<div class="dc-costs-hd">Position Costs</div>'
    + tile('Cost of 100 Shares', '$' + fmt(shares100))
    + tile('Cost of 1 Call (Debit)', '$' + fmt(debit))
    + tile('Stock Breakeven', '$' + fmt(price))
    + tile('Option Breakeven', '$' + fmt(optBe), 'var(--green)')
    + tile('Max Loss — Stock', '−$' + fmt(shares100), 'var(--red)')
    + tile('Max Loss — Call', '−$' + fmt(debit), 'var(--red)')
    + tile('Days to Expiry', dte == null ? '—' : dte);

  // Special-level labels keyed by rounded price.
  const labels = {};
  labels[0] = 'Total loss';
  labels[Math.round(price * 100) / 100] = 'Stock breakeven';
  labels[Math.round(strike * 100) / 100] = 'Strike';
  labels[Math.round(optBe * 100) / 100] = 'Option breakeven';

  const pnlCell = v =>
    '<td style="color:' + (v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--mu2)') + '">'
    + (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + fmt(Math.abs(v)) + '</td>';
  const pctCell = v =>
    '<td style="color:' + (v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--mu2)') + '">'
    + (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v) * 100) + '%</td>';

  const rows = ditmLevels(price, strike, optBe).map(lvl => {
    const stockPL = (lvl - price) * M;
    const callPL = Math.max(lvl - strike, 0) * M - debit;
    const lbl = labels[lvl] || '';
    return '<tr' + (lbl ? ' class="dc-special"' : '') + '>'
      + '<td>$' + fmt(lvl) + '</td>'
      + pnlCell(stockPL) + pctCell(stockPL / shares100)
      + pnlCell(callPL) + pctCell(callPL / debit)
      + '<td class="dc-lbl">' + lbl + '</td>'
      + '</tr>';
  }).join('');

  matrix.innerHTML =
    '<table class="dc-matrix"><thead><tr>'
    + '<th>Price</th><th>Stock P/L</th><th>Stock %</th>'
    + '<th>Call P/L</th><th>Call %</th><th></th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

// Close on Esc / click outside (element ships to both apps, only wired on Wheeler).
(function () {
  const ov = document.getElementById('ditm-overlay');
  if (!ov) return;
  ov.addEventListener('click', function (e) { if (e.target === ov) closeDitmCalc(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ov.classList.contains('open')) closeDitmCalc();
  });
})();
