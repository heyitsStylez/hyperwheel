// Boots the app inside jsdom with deterministic stubs.
// - Pre-seeds wallet so the first-visit popup branch is skipped.
// - Stubs window.fetch (network-free) and window.Chart (no Chart.js in tests).
// - Loads body.html + modals.html so DOM lookups in boot/render don't crash.
// - Calls loadApp() to evaluate the concatenated src/js/*.js inside the window.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadApp } = require('./loadApp');

const ROOT = path.join(__dirname, '..', '..');

function setupJsdom({ wallet = '0x' + '1'.repeat(40), trades = [] } = {}) {
  const body = fs.readFileSync(path.join(ROOT, 'src', 'html', 'body.html'), 'utf8');
  const modals = fs.readFileSync(path.join(ROOT, 'src', 'html', 'modals.html'), 'utf8');

  const html = `<!doctype html><html><head></head><body>${body}${modals}</body></html>`;

  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously' });
  const { window } = dom;

  // Pre-seed localStorage before app boot reads it.
  window.localStorage.setItem('hw_wallet', wallet);
  window.localStorage.setItem('hw_holdings', JSON.stringify(trades));

  // Network stub — every fetch returns a never-resolving promise so that
  // callbacks (fetchExpiryPrices, cloudPull, autoLoadChain) don't fire
  // render() after the test body completes and we tear down the window.
  window.fetch = () => new Promise(() => {});

  // Chart.js stub — constructor + minimal instance API used by render-charts.
  window.Chart = function () {
    return { destroy() {}, update() {}, resize() {} };
  };
  window.Chart.defaults = { font: {}, plugins: {} };
  window.Chart.register = () => {};

  // jsdom doesn't implement canvas 2d context or scrollIntoView. The chart
  // module reaches getContext().scale before the Chart() ctor would be called.
  window.HTMLCanvasElement.prototype.getContext = function () {
    const gradient = { addColorStop() {} };
    return {
      scale() {}, fillRect() {}, clearRect() {}, fillText() {},
      beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
      bezierCurveTo() {}, quadraticCurveTo() {},
      save() {}, restore() {}, translate() {}, closePath() {}, arc() {},
      setLineDash() {}, rect() {}, strokeRect() {},
      measureText: () => ({ width: 0 }),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    };
  };
  window.Element.prototype.scrollIntoView = function () {};

  // requestAnimationFrame is provided by jsdom, but ensure a fallback.
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }

  loadApp(window);

  // 16-clock.js sets a setInterval that would keep Node's event loop alive
  // forever. Tests must dispose the window to release timers.
  const teardown = () => dom.window.close();

  return { dom, window, teardown };
}

module.exports = { setupJsdom };
