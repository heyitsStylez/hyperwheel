// Wheeler (tradfi) Google-auth + cloud-sync integration (#110, Design B). Boots
// the artifact in jsdom and drives authInit()/cloudPush() with a routed fetch
// stub to assert the signed-out gate, a newer-remote pull, and per-user push.
const { test } = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const trade = (over = {}) => ({
  id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
  strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL', ...over,
});

test('signed out: authInit renders the Sign in with Google gate', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);

  window.fetch = () => ok({ authed: false });
  await window.authInit();

  const gate = window.document.getElementById('wheeler-auth').innerHTML;
  assert.match(gate, /SIGN IN WITH GOOGLE/);
  assert.doesNotMatch(gate, /SIGN OUT/);
});

test('signed in with newer remote: pulls trades and shows the account', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [] });
  t.after(teardown);

  window.fetch = () => ok({
    authed: true, email: 'owner@gmail.com',
    trades: [trade()], savedAt: Date.now(),
  });
  await window.authInit();

  // Pull replaces local state and persists it under wheeler_trades.
  const persisted = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  assert.strictEqual(persisted.length, 1, 'remote trades should replace local');
  assert.strictEqual(persisted[0].asset, 'IBIT');
  assert.strictEqual(window.compute().lots.IBIT.length, 1, 'pulled lot should render');
  const gate = window.document.getElementById('wheeler-auth').innerHTML;
  assert.match(gate, /owner@gmail\.com/);
  assert.match(gate, /SIGN OUT/);
});

test('signed in: cloudPush POSTs the full trade array to the per-user endpoint', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: [trade()] });
  t.after(teardown);

  // Sign in with an empty remote so authInit flips auth state on (no pull).
  window.fetch = () => ok({ authed: true, email: 'o@g.com', trades: [], savedAt: 0 });
  await window.authInit();

  let posted = null;
  window.fetch = (url, opts) => {
    if (opts && opts.method === 'POST') { posted = { url, body: JSON.parse(opts.body) }; }
    return ok({ ok: true });
  };
  await window.cloudPush();

  assert.ok(posted, 'a POST should have been made');
  assert.match(posted.url, /\/api\/wheeler-sync/);
  assert.strictEqual(posted.body.trades.length, 1);
  assert.strictEqual(posted.body.trades[0].asset, 'IBIT');
});
