// ── MERGE LOTS ───────────────────────────────────────────────

function openMergeModal(asset) {
  mergeAsset = asset;
  document.getElementById('merge-title').textContent = 'Merge ' + asset + ' Lots';

  // Build a preview by using the pure merge helper on a cloned trades array.
  // This keeps arithmetic out of the modal and ensures preview computation
  // matches the merge operation performed on confirm.
  const previewTrades = mergeOpenLots(JSON.parse(JSON.stringify(trades)), asset);

  // Temporarily run compute against the preview trades to extract the merged lot info
  let mergedLot = null;
  if (typeof window !== 'undefined') window.__merge_preview_trades = window.trades;
  else if (typeof global !== 'undefined') global.__merge_preview_trades = global.trades;
  try {
    if (typeof window !== 'undefined') window.trades = previewTrades;
    if (typeof global !== 'undefined') global.trades = previewTrades;
    const previewResult = compute('ALL');
    const lots = (previewResult.lots && previewResult.lots[asset]) || [];
    mergedLot = lots.find(l => l.open) || null;
  } finally {
    if (typeof window !== 'undefined') {
      window.trades = window.__merge_preview_trades;
      delete window.__merge_preview_trades;
    }
    if (typeof global !== 'undefined') {
      global.trades = global.__merge_preview_trades;
      delete global.__merge_preview_trades;
    }
  }

  if (!mergedLot) return;

  const totalSize = mergedLot.size;
  const avgCost = mergedLot.costBasis;
  const totalCCPrem = mergedLot.lotPremiums;
  const mergedNC = mergedLot.netCost;

  let html = '<div class="merge-preview">';
  html += '<div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:8px">Lots being merged</div>';
  // Show the lot rows from compute's preview (tradeIds -> lotNum may be present)
  const resultNow = compute('ALL');
  const assetLotsNow = (resultNow.lots[asset] || []).filter(l => l.open);
  assetLotsNow.forEach(l => {
    html += '<div class="mp-row"><span class="mp-lbl">Lot ' + l.lotNum + '</span><span class="mp-val">' + l.size + ' ' + asset + ' @ $' + fmt(l.costBasis) + ' (NC: $' + fmt(l.netCost) + ')</span></div>';
  });
  html += '<div style="border-top:1px solid var(--bd2);margin:8px 0"></div>';
  html += '<div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:8px">Merged result</div>';
  html += '<div class="mp-row"><span class="mp-lbl">Size</span><span class="mp-val">' + totalSize + ' ' + asset + '</span></div>';
  html += '<div class="mp-row"><span class="mp-lbl">Avg Cost Basis</span><span class="mp-val">$' + fmt(avgCost) + '</span></div>';
  html += '<div class="mp-row"><span class="mp-lbl">CC Premiums</span><span class="mp-val green">$' + fmt(totalCCPrem) + '</span></div>';
  html += '<div class="mp-row"><span class="mp-lbl">Net Cost / ' + asset + '</span><span class="mp-val orange">$' + fmt(mergedNC) + '</span></div>';
  html += '</div>';

  document.getElementById('merge-preview').innerHTML = html;
  document.getElementById('merge-overlay').classList.add('open');
}

function closeMergeModal() {
  document.getElementById('merge-overlay').classList.remove('open');
  mergeAsset = null;
}

function confirmMerge() {
  if (!mergeAsset) return;
  const asset = mergeAsset;

  // Quick guard: if fewer than two open lots, no-op
  const result = compute('ALL');
  const openLots = (result.lots[asset] || []).filter(l => l.open);
  if (openLots.length < 2) { closeMergeModal(); return; }

  // Use the pure helper to produce the merged trades array, then persist
  const merged = mergeOpenLots(trades, asset);
  // If mergeOpenLots returned the same shape, assume no-op
  if (!merged || merged.length === 0) { closeMergeModal(); return; }

  trades = merged;
  save();
  render();
  closeMergeModal();
}

// Close merge modal on backdrop click
document.addEventListener('DOMContentLoaded', function() {
  const mov = document.getElementById('merge-overlay');
  if (mov) mov.addEventListener('click', function(e) {
    if (e.target === this) closeMergeModal();
  });
});
