// ── RENDER
function render() {
  // Wheeler tabs are data-derived, so a filtered ticker can vanish when its last
  // trade is deleted — fall back to ALL rather than showing an empty, tab-less view.
  if (_isTradfi() && sFilter !== 'ALL' && !trades.some(t => t.asset === sFilter)) sFilter = 'ALL';
  const { streams, lots, allRows, displayRows } = compute(sFilter);
  rFilterTabs();
  rStats(streams, lots, allRows, displayRows);
  rTable(displayRows, streams, lots);
  rOutcomeChart();
  rCharts(displayRows, lots);
  rPnlCalendar();  // Wheeler only — self-gates on tradfi
}
