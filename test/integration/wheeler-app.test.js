// Wheeler (tradfi) app integration test — boots the second artifact in jsdom and
// drives manual entry. Covers #90 acceptance: no wallet gate + empty-state prompt,
// arbitrary-ticker HOLDING + option tracking net cost, wheeler_trades persistence
// (hw_holdings untouched), and open/history/holdings rendering.
const { test } = require('node:test');
const assert = require('node:assert');
const { setupJsdom } = require('../helpers/setupJsdom');

test('fresh Wheeler boot: no wallet gate, empty-state prompt', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);

  // No wallet/login gate.
  assert.strictEqual(window.document.getElementById('wallet-overlay'), null,
    'Wheeler must not render a wallet overlay');
  assert.strictEqual(window.localStorage.getItem('hw_wallet'), null,
    'Wheeler must not touch the crypto wallet key');

  // Empty-state prompt in the open-positions body.
  const openBody = window.document.getElementById('ttbody-open').innerHTML;
  assert.match(openBody, /No trades logged yet/);
  assert.match(openBody, /LOG FIRST TRADE/);
});

test('manual HOLDING + covered CALL on arbitrary ticker tracks net cost', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const doc = window.document;
  const setVal = (id, v) => { doc.getElementById(id).value = v; };

  // HOLDING: 100 IBIT shares @ cost basis $60.
  window.setTicker('IBIT');
  window.setType('HOLDING');
  setVal('f-date', '2026-01-02');
  setVal('f-strike', '60');
  setVal('f-size', '100');
  window.wheelerAddTrade();

  // Covered CALL against the lot: strike 65, 1 contract (= 100 shares),
  // premium $100 (stays open).
  window.setTicker('IBIT');
  window.setType('CALL');
  window.setOut('OPEN');
  setVal('f-date', '2026-01-05');
  setVal('f-expiry', '2026-02-05');
  setVal('f-dte', '31');
  setVal('f-strike', '65');
  setVal('f-size', '1');
  setVal('f-prem', '100');
  window.wheelerAddTrade();

  // Net cost = costBasis − lotPremiums/size = 60 − 100/100 = 59.
  const { lots } = window.compute();
  const openLot = (lots.IBIT || []).find(l => l.open);
  assert.ok(openLot, 'IBIT open lot should exist');
  assert.strictEqual(openLot.netCost, 59);

  // Holdings card + open table render for the arbitrary ticker.
  assert.match(window.document.getElementById('ncbwrap').innerHTML, /IBIT/);
  assert.match(window.document.getElementById('ncbwrap').innerHTML, /\$59\b/);
  assert.match(window.document.getElementById('ttbody-open').innerHTML, /IBIT/);
});

test('closed-early history row shows the close date and an edit affordance', async (t) => {
  const trades = [
    { id: 1, asset: 'PURR', type: 'CALL', date: '2026-07-15', expiry: '2026-08-21',
      dte: 37, strike: 9, size: 100, premium: 55, outcome: 'CLOSED',
      closeCost: 5, closeDate: '2026-08-11', platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades });
  t.after(teardown);
  const hist = window.document.getElementById('ttbody-hist').innerHTML;
  assert.match(hist, /closed 2026-08-11/, 'close date is surfaced on the closed row');
  assert.match(hist, /openEditModal\(1\)/, 'closed rows expose an edit affordance');
});

test('two rapid manual adds get distinct ids (no Date.now collision)', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const setVal = (id, v) => { window.document.getElementById(id).value = v; };

  // Freeze the clock so both adds see the same millisecond — the collision case.
  const fixed = 1_700_000_000_000;
  const origNow = window.Date.now;
  window.Date.now = () => fixed;
  t.after(() => { window.Date.now = origNow; });

  window.setTicker('IBIT');
  window.setType('HOLDING');
  setVal('f-date', '2026-01-02');
  setVal('f-strike', '60');
  setVal('f-size', '100');
  window.wheelerAddTrade();

  window.setTicker('IBIT');
  window.setType('CALL');
  window.setOut('OPEN');
  setVal('f-date', '2026-01-05');
  setVal('f-expiry', '2026-02-05');
  setVal('f-strike', '65');
  setVal('f-size', '1');
  setVal('f-prem', '100');
  window.wheelerAddTrade();

  const ids = JSON.parse(window.localStorage.getItem('wheeler_trades')).map(t => t.id);
  assert.strictEqual(ids.length, 2, 'both trades should persist');
  assert.strictEqual(new Set(ids).size, ids.length, 'trade ids must be unique');
});

test('Wheeler persists to wheeler_trades and never writes hw_holdings', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const setVal = (id, v) => { window.document.getElementById(id).value = v; };

  window.setTicker('MSTR');
  window.setType('HOLDING');
  setVal('f-date', '2026-03-01');
  setVal('f-strike', '350');
  setVal('f-size', '10');
  window.wheelerAddTrade();

  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].asset, 'MSTR');
  assert.strictEqual(stored[0].type, 'HOLDING');
  assert.strictEqual(window.localStorage.getItem('hw_holdings'), null,
    'Wheeler must not write the crypto holdings key');
});

test('Wheeler drops the Platform column; HyperWheel keeps it', async (t) => {
  const wheeler = await setupJsdom({ app: 'tradfi' });
  t.after(wheeler.teardown);
  assert.doesNotMatch(wheeler.window._openHeaders(), /Platform/,
    'Wheeler open table must not show a Platform column');
  assert.doesNotMatch(wheeler.window._histHeaders(), /Platform/,
    'Wheeler history table must not show a Platform column');

  const crypto = await setupJsdom({ app: 'crypto' });
  t.after(crypto.teardown);
  assert.match(crypto.window._openHeaders(), /Platform/,
    'HyperWheel must still show the Platform column');
});

test('Wheeler buy-to-close nets closeCost off the premium', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const setVal = (id, v) => { window.document.getElementById(id).value = v; };

  window.setTicker('IBIT');
  window.setType('CALL');
  window.setOut('CLOSED');
  // Close-cost field is revealed only for the CLOSED outcome.
  assert.notStrictEqual(window.document.getElementById('field-closecost').style.display, 'none');
  setVal('f-date', '2026-01-05');
  setVal('f-expiry', '2026-02-05');
  setVal('f-strike', '65');
  setVal('f-size', '1');
  setVal('f-prem', '100');
  setVal('f-closecost', '40');
  window.wheelerAddTrade();

  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].outcome, 'CLOSED');
  assert.strictEqual(stored[0].closeCost, 40);

  // Cash-flow lens: realised = net premium = 100 − 40 = 60.
  const { realised } = window.computePnl(stored, 'ALL', {});
  assert.strictEqual(realised, 60);
});

test('Wheeler open option row shows a Close button; HyperWheel does not', async (t) => {
  const seed = [
    { id: 1, asset: 'PURR', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 65, size: 100, premium: 100, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const wheeler = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(wheeler.teardown);
  const openBody = wheeler.window.document.getElementById('ttbody-open').innerHTML;
  assert.match(openBody, /btn-qa-cls/, 'Wheeler open option should offer a Close button');
  assert.match(openBody, /openEditModal\(1,'CLOSED'\)/);

  const cryptoSeed = [
    { id: 2, asset: 'BTC', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 90000, size: 0.05, premium: 100, outcome: 'OPEN', closeCost: 0, platform: 'RYSK' },
  ];
  const crypto = await setupJsdom({ app: 'crypto', trades: cryptoSeed });
  t.after(crypto.teardown);
  assert.doesNotMatch(crypto.window.document.getElementById('ttbody-open').innerHTML, /btn-qa-cls/,
    'HyperWheel closes come from chain-sync — no manual Close button');
});

test('edit modal closes an open option: sets CLOSED + closeCost, nets premium', async (t) => {
  const seed = [
    { id: 7, asset: 'PURR', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 65, size: 100, premium: 100, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);

  // Row Close button opens the edit modal preset to CLOSED, revealing close cost.
  window.openEditModal(7, 'CLOSED');
  assert.strictEqual(window.document.getElementById('ef-outcome').value, 'CLOSED');
  assert.notStrictEqual(window.document.getElementById('ef-closecost-field').style.display, 'none');

  window.document.getElementById('ef-closecost').value = '40';
  window.saveEdit();

  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  assert.strictEqual(stored[0].outcome, 'CLOSED');
  assert.strictEqual(stored[0].closeCost, 40);

  // Realised = net premium = 100 − 40 = 60.
  assert.strictEqual(window.computePnl(stored, 'ALL', {}).realised, 60);
});

test('edit modal shows option size as contracts and stores shares on save', async (t) => {
  const seed = [
    { id: 3, asset: 'IBIT', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 70, size: 300, premium: 120, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);
  const doc = window.document;

  window.openEditModal(3);
  // Field is labelled Contracts and shows 3, not 300 shares.
  assert.match(doc.getElementById('edit-fields').innerHTML, /Contracts/);
  assert.strictEqual(doc.getElementById('ef-size').value, '3');

  // Editing to 5 contracts stores 500 shares.
  doc.getElementById('ef-size').value = '5';
  window.saveEdit();
  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  assert.strictEqual(stored[0].size, 500, '5 contracts must persist as 500 shares');
});

test('form boundary: entering N contracts stores N×100 shares (options only)', async (t) => {
  const { window, teardown } = await setupJsdom({ app: 'tradfi' });
  t.after(teardown);
  const setVal = (id, v) => { window.document.getElementById(id).value = v; };

  // Option: 3 contracts → 300 shares.
  window.setTicker('IBIT');
  window.setType('PUT');
  window.setOut('OPEN');
  setVal('f-date', '2026-01-05');
  setVal('f-expiry', '2026-02-05');
  setVal('f-strike', '55');
  setVal('f-size', '3');
  setVal('f-prem', '90');
  window.wheelerAddTrade();

  // Holding: entered as a raw share count — no ×100.
  window.setTicker('IBIT');
  window.setType('HOLDING');
  setVal('f-date', '2026-01-02');
  setVal('f-strike', '60');
  setVal('f-size', '250');
  window.wheelerAddTrade();

  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  const put = stored.find(t => t.type === 'PUT');
  const holding = stored.find(t => t.type === 'HOLDING');
  assert.strictEqual(put.size, 300, '3 contracts must store 300 shares');
  assert.strictEqual(holding.size, 250, 'holding share count must not be multiplied');
});

test('autofill from lot rewrites size as contracts (round-trips through ×100)', async (t) => {
  // A prior CALL (300 shares = 3 contracts) is what autoFillFromLot pulls back
  // into the contracts field when logging its EXPIRED close.
  const seed = [
    { id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
      strike: 60, size: 300, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
    { id: 2, asset: 'IBIT', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 70, size: 300, premium: 120, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);

  // Log the CALL expiring: selecting the outcome autofills strike/size from the
  // prior CALL. The size field must show 3 (contracts), not 300 (shares).
  window.setTicker('IBIT');
  window.setType('CALL');
  window.setOut('EXPIRED');
  assert.strictEqual(window.document.getElementById('f-size').value, '3',
    'autofill must convert stored shares back to contracts');

  window.document.getElementById('f-date').value = '2026-02-05';
  window.document.getElementById('f-expiry').value = '2026-02-05';
  window.wheelerAddTrade();

  // Re-storing must land back on 300 shares, not 30000.
  const stored = JSON.parse(window.localStorage.getItem('wheeler_trades'));
  const expired = stored.find(s => s.outcome === 'EXPIRED');
  assert.strictEqual(expired.size, 300, 'round-trip must preserve share count');
});

test('display toggle: size renders as contracts or shares across tables + cards', async (t) => {
  const seed = [
    { id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
      strike: 60, size: 300, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
    { id: 2, asset: 'IBIT', type: 'CALL', date: '2026-01-05', expiry: '2026-02-05', dte: 31,
      strike: 70, size: 300, premium: 120, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);
  const doc = window.document;
  const openBody = () => doc.getElementById('ttbody-open').innerHTML;
  const holdings = () => doc.getElementById('ncbwrap').innerHTML;

  // Default is contracts for option rows: 300 shares → "3 ct". Holdings are
  // physical shares, so the holdings card always shows shares regardless of toggle.
  assert.match(openBody(), /3 ct/, 'open table should show contracts by default');
  assert.doesNotMatch(openBody(), /300 sh/);
  assert.match(holdings(), /300 sh/, 'holdings card should always show shares');

  // Toggle to shares.
  window.setSizeDisplay('shares');
  assert.match(openBody(), /300 sh/, 'open table should show shares after toggle');
  assert.doesNotMatch(openBody(), /3 ct/);
  assert.match(holdings(), /300 sh/, 'holdings card stays in shares after toggle');

  // Toggle button reflects active state.
  assert.match(doc.getElementById('sd-shares').className, /active/);
  assert.doesNotMatch(doc.getElementById('sd-contracts').className, /active/);
});

test('seeded wheeler_trades load on boot and survive a reload', async (t) => {
  const seed = [
    { id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
      strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);

  const { lots } = window.compute();
  assert.ok((lots.IBIT || []).some(l => l.open), 'seeded IBIT holding should load into a lot');
});

test('filter tabs are derived from traded tickers and scope the view', async (t) => {
  const seed = [
    { id: 1, asset: 'IBIT', type: 'HOLDING', date: '2026-01-02', expiry: '', dte: null,
      strike: 60, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
    { id: 2, asset: 'PURR', type: 'HOLDING', date: '2026-01-03', expiry: '', dte: null,
      strike: 12, size: 200, premium: 0, outcome: 'OPEN', closeCost: 0, platform: 'MANUAL' },
  ];
  const { window, teardown } = await setupJsdom({ app: 'tradfi', trades: seed });
  t.after(teardown);
  const doc = window.document;

  // One tab per traded ticker plus the All Tickers tab — no fixed crypto roster.
  const bar = doc.querySelector('.asset-tabs');
  assert.ok(doc.getElementById('fb-IBIT'), 'IBIT tab rendered from trades');
  assert.ok(doc.getElementById('fb-PURR'), 'PURR tab rendered from trades');
  assert.strictEqual(doc.getElementById('fb-BTC'), null, 'no fixed crypto tabs on Wheeler');
  assert.match(bar.innerHTML, /All Tickers/);

  // setFilter scopes to a single ticker and marks its tab active.
  window.setFilter('PURR');
  assert.match(doc.getElementById('fb-PURR').className, /active/);
  assert.doesNotMatch(doc.getElementById('fb-IBIT').className, /active/);
  const holdings = doc.getElementById('ncbwrap').innerHTML;
  assert.match(holdings, /PURR/);
  assert.doesNotMatch(holdings, /IBIT/);

  // Deleting the filtered ticker's last trade falls back to ALL, not an empty view.
  window.deleteTrade(2);
  assert.strictEqual(doc.getElementById('fb-PURR'), null, 'vanished ticker has no tab');
  assert.match(doc.getElementById('fb-ALL').className, /active/, 'filter falls back to ALL');
  assert.match(doc.getElementById('ncbwrap').innerHTML, /IBIT/, 'remaining ticker still shows');
});
