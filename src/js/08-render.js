// ── RENDER
function render() {
  const { streams, lots, allRows, displayRows, timeline } = compute(sFilter);
  rStats(streams, lots, displayRows);
  rTable(displayRows, streams, lots);
  // expose for UI controls that invoke rCpnlChart without args
  if (typeof window !== 'undefined') window.__cpnlTimeline = timeline;
  rCharts(displayRows, timeline);
}
