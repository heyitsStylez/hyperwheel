// ── MERGE LOTS ───────────────────────────────────────────────

function openMergeModal(asset) {
  mergeAsset = asset;
  document.getElementById('merge-title').textContent = 'Merge ' + asset + ' Lots';

  // Run compute to get current lot state
  const result = compute('ALL');
  const assetLots = (result.lots[asset] || []).filter(l => l.open);
  if (assetLots.length < 2) return;

  // Calculate merged values
  let totalSize = 0, weightedCost = 0, totalCCPrem = 0;
  assetLots.forEach(l => {
    totalSize += l.size;
    weightedCost += l.costBasis * l.size;
    totalCCPrem += l.lotPremiums;
  });
  const avgCost = weightedCost / totalSize;
  const mergedNC = lotNetCost(avgCost, totalCCPrem, totalSize);

  let html = '<div class="merge-preview">';
  html += '<div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:8px">Lots being merged</div>';
  assetLots.forEach(l => {
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

  // Find all lot-opening trades (HOLDING or ASSIGNED) for this asset that lead to open lots
  // We need to run compute to know which lots are open
  const result = compute('ALL');
  const openLots = (result.lots[asset] || []).filter(l => l.open);
  if (openLots.length < 2) { closeMergeModal(); return; }

  // Calculate merged values
  let totalSize = 0, weightedCost = 0, totalCCPrem = 0;
  const allTradeIds = [];
  openLots.forEach(l => {
    totalSize += l.size;
    weightedCost += l.costBasis * l.size;
    totalCCPrem += l.lotPremiums;
    allTradeIds.push(...l.tradeIds);
  });
  const avgCost = weightedCost / totalSize;

  // Find the lot-opening trade IDs (HOLDING or ASSIGNED outcomes)
  const lotOpenIds = new Set();
  openLots.forEach(l => {
    // First trade in each lot's tradeIds is the lot opener
    if (l.tradeIds.length) lotOpenIds.add(l.tradeIds[0]);
  });

  // Keep the earliest lot opener, remove the rest
  const lotOpeners = trades.filter(t => lotOpenIds.has(t.id) && t.asset === asset);
  lotOpeners.sort((a, b) => a.id - b.id);
  const keepTrade = lotOpeners[0];
  const removeIds = new Set(lotOpeners.slice(1).map(t => t.id));

  // Update the kept trade to have merged values
  keepTrade.strike = avgCost;
  keepTrade.size = totalSize;

  // Reassign all CALL trades from other lots to have no explicit lotNum
  // (they'll naturally attach to the single remaining lot via compute)
  trades.forEach(t => {
    if (t.asset === asset && t.type === 'CALL' && t.lotNum != null) {
      // Clear lotNum so compute assigns to the single open lot
      delete t.lotNum;
    }
  });

  // Remove the extra lot-opening trades
  trades = trades.filter(t => !removeIds.has(t.id));

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
