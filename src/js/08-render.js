// ── RENDER
function render() {
  const { streams, lots, allRows, displayRows } = compute(sFilter);
  rStats(streams, lots, displayRows);
  rTable(displayRows, streams, lots);
  rCharts(displayRows, lots);
}
