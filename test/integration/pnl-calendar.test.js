// P&L Calendar renders on Wheeler and is gated off on HyperWheel. Bucketing math
// is covered by test/unit/pnl-calendar.test.js; this asserts the render wiring.
const { test } = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('Wheeler renders the P&L Calendar grid + month nav', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const sec = window.document.getElementById('pnl-cal-sec');
  assert.ok(sec, 'calendar container exists');
  assert.ok(sec.querySelector('.cal-grid'), 'grid rendered');
  assert.ok(sec.querySelector('.cal-month'), 'month label rendered');
  // 8 header labels: Sun–Sat + WEEK.
  assert.strictEqual(sec.querySelectorAll('.cal-dow').length, 8);
  // Month nav is wired and re-renders without throwing.
  const before = sec.querySelector('.cal-month').textContent;
  window.setCalMonth(-1);
  const after = window.document.querySelector('#pnl-cal-sec .cal-month').textContent;
  assert.notStrictEqual(after, before, 'prev-month nav changes the label');
});

test('HyperWheel does not render the P&L Calendar', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'crypto' });
  t.after(teardown);
  const sec = window.document.getElementById('pnl-cal-sec');
  assert.ok(sec, 'container still ships in the shared shell');
  assert.strictEqual(sec.innerHTML, '', 'calendar is empty on crypto');
});
