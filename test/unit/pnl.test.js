const test = require('node:test');
const assert = require('node:assert');
const { computePnl } = require('../../src/js/05b-pnl.js');

test('PUT EXPIRED → realised = netPrem', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 120);
});

test('PUT ASSIGNED → realised = netPrem (capital gain only on later call-away)', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 200);
});

test('CALL CALLED on assigned lot → realised += netPrem + (strike − costBasis) × calledSize', () => {
  // PUT assigned at 50000 (size 0.1) → costBasis=50000. Later CALL at 55000 size 0.1, premium 80.
  // Realised = 200 (put prem) + 80 (call prem) + (55000-50000)*0.1 = 280 + 500 = 780
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'CALL', date: '2026-01-20', expiry: '2026-02-03',
      strike: 55000, size: 0.1, premium: 80, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 780);
});

test('CALL CALLED on HOLDING-originated lot → capital gain counted same as ASSIGNED (no special case)', () => {
  // HOLDING bought at 3000 size 1. CALL at 3500 size 1 premium 50, called.
  // Realised = 50 (call prem) + (3500-3000)*1 = 550
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 550);
});

test('CALL EXPIRED on open lot → realised += netPrem', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-05', expiry: '2026-01-19',
      strike: 3500, size: 1, premium: 60, outcome: 'EXPIRED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 60);
});

test('CALL CLOSED with closeCost > premium → realised takes negative netPrem cleanly', () => {
  // Buy-to-close at a loss: premium 50, closeCost 80 → netPrem = -30
  const trades = [
    { id: 1, asset: 'HYPE', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 30, size: 100, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'HYPE', type: 'CALL', date: '2026-01-10', expiry: '2026-01-24',
      strike: 35, size: 100, premium: 50, outcome: 'CLOSED', closeCost: 80 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, -30);
});

test('OPEN option contributes 0 to realised', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'OPEN', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 0);
});

test('partial call-away realises only calledSize × (strike − costBasis)', () => {
  // Lot opens at 3000, size 2 (HOLDING). CALL at 3500 size 1 (partial), called.
  // Realised = 40 (premium) + (3500-3000)*1 = 540. Lot remains open with size 1.
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 2, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      strike: 3500, size: 1, premium: 40, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realised } = computePnl(trades);
  assert.strictEqual(realised, 540);
});

test('asset filter scopes realised to one asset', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 100, outcome: 'EXPIRED', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 3000, size: 1, premium: 50, outcome: 'EXPIRED', closeCost: 0 },
  ];
  assert.strictEqual(computePnl(trades, 'BTC').realised, 100);
  assert.strictEqual(computePnl(trades, 'ETH').realised, 50);
  assert.strictEqual(computePnl(trades, 'ALL').realised, 150);
  assert.strictEqual(computePnl(trades).realised, 150);
});

test('empty trades → realised = 0', () => {
  assert.strictEqual(computePnl([]).realised, 0);
});

test('unrealised marks open HOLDING lot to market: (spot − costBasis) × size', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 2, premium: 0, outcome: 'OPEN', closeCost: 0 },
  ];
  const livePrices = { ETH: 3500 };
  const { unrealised } = computePnl(trades, 'ALL', livePrices);
  assert.strictEqual(unrealised, 1000); // (3500 - 3000) * 2
});

test('unrealised on ASSIGNED-originated lot uses raw costBasis (not netCost)', () => {
  // PUT assigned at 50000 size 0.1 with premium 200. costBasis=50000, lotPremiums=200.
  // netCost would be 50000 - (200/0.1) = 48000. Unrealised must use costBasis (50000).
  // Spot 52000 → unrealised = (52000 - 50000) * 0.1 = 200 (NOT (52000-48000)*0.1 = 400).
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 200, outcome: 'ASSIGNED', closeCost: 0 },
  ];
  const { unrealised } = computePnl(trades, 'ALL', { BTC: 52000 });
  assert.strictEqual(unrealised, 200);
});

test('called-away lot contributes zero to unrealised (closed)', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-01-15', expiry: '2026-01-29',
      strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ];
  const { unrealised } = computePnl(trades, 'ALL', { ETH: 4000 });
  assert.strictEqual(unrealised, 0);
});

test('missing spot for one asset → excluded from unrealised, others sum, asset listed', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN', closeCost: 0 },
  ];
  const { unrealised, missingSpotAssets } = computePnl(trades, 'ALL', { ETH: 3500 });
  assert.strictEqual(unrealised, 500); // ETH only: (3500-3000)*1
  assert.deepStrictEqual(missingSpotAssets, ['BTC']);
});

test('missing spot for all assets → unrealised = 0, all listed', () => {
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN', closeCost: 0 },
  ];
  const { unrealised, missingSpotAssets } = computePnl(trades, 'ALL', {});
  assert.strictEqual(unrealised, 0);
  assert.deepStrictEqual(missingSpotAssets.sort(), ['BTC', 'ETH']);
});

test('total = realised + unrealised', () => {
  // PUT EXPIRED → realised 100. HOLDING ETH at 3000 size 1, spot 3500 → unrealised 500. Total 600.
  const trades = [
    { id: 1, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 2800, size: 1, premium: 100, outcome: 'EXPIRED', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
  ];
  const { realised, unrealised, total } = computePnl(trades, 'ALL', { ETH: 3500 });
  assert.strictEqual(realised, 100);
  assert.strictEqual(unrealised, 500);
  assert.strictEqual(total, 600);
});

test('asset filter scopes unrealised + total', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 50000, size: 0.1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
  ];
  const lp = { BTC: 52000, ETH: 3500 };
  assert.strictEqual(computePnl(trades, 'BTC', lp).unrealised, 200);
  assert.strictEqual(computePnl(trades, 'ETH', lp).unrealised, 500);
  assert.strictEqual(computePnl(trades, 'ALL', lp).unrealised, 700);
});

test('realisedByMonth: buckets settled events by expiry YYYY-MM', () => {
  // Jan: PUT EXPIRED +120. Feb: HOLDING + CALL CALLED → premium 50 + cap gain 500 = 550.
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 120, outcome: 'EXPIRED', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 3, asset: 'ETH', type: 'CALL', date: '2026-02-01', expiry: '2026-02-15',
      strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realisedByMonth } = computePnl(trades);
  assert.strictEqual(realisedByMonth['2026-01'], 120);
  assert.strictEqual(realisedByMonth['2026-02'], 550);
});

test('realisedByMonth: empty when no settled events', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 120, outcome: 'OPEN', closeCost: 0 },
  ];
  const { realisedByMonth } = computePnl(trades);
  assert.deepStrictEqual(realisedByMonth, {});
});

test('realisedByMonth: respects asset filter', () => {
  const trades = [
    { id: 1, asset: 'BTC', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 50000, size: 0.1, premium: 100, outcome: 'EXPIRED', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'PUT', date: '2026-01-01', expiry: '2026-01-15',
      strike: 3000, size: 1, premium: 50, outcome: 'EXPIRED', closeCost: 0 },
  ];
  assert.deepStrictEqual(computePnl(trades, 'BTC').realisedByMonth, { '2026-01': 100 });
  assert.deepStrictEqual(computePnl(trades, 'ETH').realisedByMonth, { '2026-01': 50 });
});

test('realisedSeries: CALLED event contributes premium AND capital gain at expiry date', () => {
  // HOLDING at 3000 size 1, then CALL at 3500 premium 50 called on 2026-02-15.
  // Series should have a point on 2026-02-15 with cumulative realised = 50 + 500 = 550.
  const trades = [
    { id: 1, asset: 'ETH', type: 'HOLDING', date: '2026-01-01', expiry: '',
      strike: 3000, size: 1, premium: 0, outcome: 'OPEN', closeCost: 0 },
    { id: 2, asset: 'ETH', type: 'CALL', date: '2026-02-01', expiry: '2026-02-15',
      strike: 3500, size: 1, premium: 50, outcome: 'CALLED', closeCost: 0 },
  ];
  const { realisedSeries } = computePnl(trades);
  assert.ok(Array.isArray(realisedSeries), 'realisedSeries should be an array');
  const last = realisedSeries[realisedSeries.length - 1];
  assert.strictEqual(last.date, '2026-02-15');
  assert.strictEqual(last.val, 550);
});

// buildDisplaySeries tests
const { buildDisplaySeries } = require('../../src/js/05b-pnl.js');

test('buildDisplaySeries: empty input returns empty', () => {
  assert.deepStrictEqual(buildDisplaySeries([], 'ALL', '2026-05-16'), []);
});

test("buildDisplaySeries: ALL prepends zero-baseline and appends today", () => {
  const series = [
    { date: '2026-01-15', val: 100 },
    { date: '2026-03-01', val: 250 },
  ];
  const result = buildDisplaySeries(series, 'ALL', '2026-05-16');
  assert.deepStrictEqual(result, [
    { date: '2026-01-15', val: 0 },
    { date: '2026-01-15', val: 100 },
    { date: '2026-03-01', val: 250 },
    { date: '2026-05-16', val: 250 },
  ]);
});

test("buildDisplaySeries: 1M with no in-range points returns flat [{cutoff,lastVal},{today,lastVal}]", () => {
  // All trades before the 30-day window
  const series = [{ date: '2026-01-15', val: 100 }];
  // today=2026-05-16 → cutoff=2026-04-16; series point is before cutoff
  const result = buildDisplaySeries(series, '1M', '2026-05-16');
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].date, '2026-04-16');
  assert.strictEqual(result[0].val, 100);
  assert.strictEqual(result[1].date, '2026-05-16');
  assert.strictEqual(result[1].val, 100);
});

test("buildDisplaySeries: baseline carry-forward is last point before the cutoff", () => {
  // today=2026-05-16 → 1M cutoff=2026-04-16
  // Two points before cutoff; baseline should be 250 (the later one)
  // One point after cutoff at 300
  const series = [
    { date: '2026-01-15', val: 100 },
    { date: '2026-03-01', val: 250 },
    { date: '2026-04-20', val: 300 },
  ];
  const result = buildDisplaySeries(series, '1M', '2026-05-16');
  // dispSeries: [{cutoff, 250}, {2026-04-20, 300}], then today appended
  assert.deepStrictEqual(result, [
    { date: '2026-04-16', val: 250 },
    { date: '2026-04-20', val: 300 },
    { date: '2026-05-16', val: 300 },
  ]);
});
