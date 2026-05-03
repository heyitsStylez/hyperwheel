const test = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('quickOutcome() marks an open PUT as EXPIRED and persists', (t) => {
  const openPut = {
    id: 42,
    asset: 'BTC', type: 'PUT', date: '2026-02-01', expiry: '2026-02-22',
    dte: 21, strike: 50000, size: 0.05, premium: 100,
    outcome: 'OPEN', closeCost: 0, platform: 'RYSK',
  };
  const { window, teardown } = setupJsdom({ trades: [openPut] });
  t.after(teardown);

  window.quickOutcome(42, 'EXPIRED');

  const stored = JSON.parse(window.localStorage.getItem('hw_holdings'));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].outcome, 'EXPIRED');

  // A toast element should have been appended.
  const toasts = window.document.querySelectorAll('#toast-stack .toast');
  assert.ok(toasts.length >= 1, 'expected a toast to be rendered');
});
