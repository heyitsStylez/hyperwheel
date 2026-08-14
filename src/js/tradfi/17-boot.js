// ── BOOT (tradfi / Wheeler) ───────────────────────────────
// No wallet popup, no chain sync, no cloud (#84): Wheeler boots straight to the
// trades table. When empty, rTable renders the "add your first trade" prompt.
// bootReady resolves once trades are loaded and the first render has run; tests
// await it, the browser ignores it.
var bootReady = (async function init() {
  trades = await loadTrades();

  // Ticker is free-text in Wheeler — start blank so nothing is pre-selected and
  // addTrade() requires the user to type a ticker.
  sAsset = '';

  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = today();

  setType(sType);
  render();
})();
