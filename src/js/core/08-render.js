// ── RENDER
function render() {
  const { streams, lots, allRows, displayRows } = compute(sFilter);
  rStats(streams, lots, allRows, displayRows);
  rTable(displayRows, streams, lots);
  rOutcomeChart();
  rCharts(displayRows, lots);
}
