// ── CHAIN SYNC ────────────────────────────────────────────
// Pulls trade history from Rysk (/api/history) and
// Hypersurface (Goldsky subgraph) for a given wallet address.
// Deduplicates by txHash; auto-imports new trades.
//
// On Vercel: routes through /api/chain-sync proxy (avoids CORS).
// On file://: falls back to direct fetch (likely CORS-blocked).

const SYMBOL_MAP = {
  UBTC: 'BTC', UETH: 'ETH',
  kHYPE: 'HYPE', WHYPE: 'HYPE', wstHYPE: 'HYPE',
  uSOL: 'SOL', USOL: 'SOL',
};
const HSFC_GOLDSKY_URL = 'https://api.goldsky.com/api/public/project_clysuc3c7f21y01ub6hd66nmp/subgraphs/hypersurface-sh-subgraph/latest/gn';

function symbolToAsset(sym) {
  return SYMBOL_MAP[sym] || sym;
}

function bigIntToNum(str, decimals) {
  try {
    return Number(BigInt(str)) / Math.pow(10, decimals);
  } catch (e) {
    return parseFloat(str) / Math.pow(10, decimals);
  }
}

function unixToDate(ts) {
  return new Date(ts * 1000).toISOString().split('T')[0];
}

function loadSynced() {
  try { return new Set(JSON.parse(localStorage.getItem(HW_SYNCED_KEY) || '[]')); } catch (e) { return new Set(); }
}

function saveSynced(set) {
  localStorage.setItem(HW_SYNCED_KEY, JSON.stringify([...set]));
}

// Returns true when running under a real web server (Vercel or local http.server)
// so the /api/chain-sync proxy is available.
function hasProxy() {
  return window.location.protocol !== 'file:';
}

// ── RYSK SYNC ─────────────────────────────────────────────

function parseRyskTrade(r) {
  const dec = r.decimals || 18;
  const asset = symbolToAsset(r.symbol);
  if (!['BTC', 'ETH', 'HYPE', 'SOL'].includes(asset)) return null;

  const strike  = bigIntToNum(r.strike,   dec);
  const size    = bigIntToNum(r.quantity, dec);
  const rawPrem = bigIntToNum(r.premium,  dec);
  // On /api/user/positions: isBuy=true = user wrote/sold option (received premium)
  // isBuy=false = user bought option (paid premium — uncommon for wheel strategy)
  const premium = r.isBuy ? Math.abs(rawPrem) : -Math.abs(rawPrem);

  const createdAt = r.createdAt || 0;
  const expiryTs  = r.expiry    || 0;
  const dte = Math.round((expiryTs - createdAt) / 86400);

  const nowTs  = Math.floor(Date.now() / 1000);
  const outcome = (expiryTs > 0 && expiryTs < nowTs) ? 'EXPIRED' : 'OPEN';

  return {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    asset,
    type:    r.isPut ? 'PUT' : 'CALL',
    date:    createdAt ? unixToDate(createdAt) : today(),
    expiry:  expiryTs  ? unixToDate(expiryTs)  : '',
    dte:     dte > 0 ? dte : null,
    strike,
    size,
    premium,
    outcome,
    platform: 'RYSK',
    txHash:  r.txHash || null,
    isClose: !r.isBuy,  // isBuy=false = user bought back (closing trade)
  };
}

async function fetchRysk(type, address) {
  if (hasProxy()) {
    const res = await fetch('/api/chain-sync?source=rysk&type=' + type + '&address=' + encodeURIComponent(address));
    if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
    return res.json();
  }
  // file:// fallback — direct fetch (likely CORS-blocked)
  const base = 'https://v12.rysk.finance/api';
  const url  = type === 'history'
    ? base + '/history?address=' + address
    : base + '/user/positions?address=' + address;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function fetchRyskExpiryPrices(underlying) {
  if (hasProxy()) {
    const res = await fetch('/api/chain-sync?source=rysk&type=expiry-prices&underlying=' + encodeURIComponent(underlying));
    if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
    return res.json();
  }
  const res = await fetch('https://v12.rysk.finance/api/expiry-prices/999/' + underlying);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Resolve Rysk outcomes using the on-chain oracle settlement price.
// positions = raw /api/user/positions array (has status, expiry, strike, txHash, address, collateral, isPut).
// Expiry-prices endpoint returns {expiryTimestamp: rawPriceAt1e8} for each underlying token.
// One fetch per unique underlying covers all strikes/expiries for that asset.
// Returns true if any local trade outcome was updated.
async function resolveRyskOutcomes(positions) {
  const nowTs   = Math.floor(Date.now() / 1000);
  const settled = positions.filter(p =>
    p.status === 'SETTLED' && parseInt(p.expiry || '0') < nowTs
  );
  if (!settled.length) return false;

  // One expiry-prices call per unique underlying (isPut → p.address, CALL → p.collateral)
  const underlyings = [...new Set(settled.map(p => (p.isPut ? p.address : p.collateral)).filter(Boolean))];
  const priceMap = {};
  for (const u of underlyings) {
    try { priceMap[u] = await fetchRyskExpiryPrices(u); } catch (e) { priceMap[u] = null; }
  }

  let changed = false;
  for (const p of settled) {
    const underlying  = p.isPut ? p.address : p.collateral;
    const expiryPrices = priceMap[underlying];
    if (!expiryPrices) continue;
    const rawPrice = expiryPrices[String(parseInt(p.expiry || '0'))];
    if (!rawPrice || rawPrice === '0') continue;

    const settlementPrice = parseInt(rawPrice)         / 1e8;
    const strikePrice     = parseInt(p.strike || '0')  / 1e18;
    const target = p.isPut
      ? (settlementPrice <= strikePrice ? 'ASSIGNED' : 'EXPIRED')
      : (settlementPrice >= strikePrice ? 'CALLED'   : 'EXPIRED');

    // Match by txHash (authoritative). Correct any non-CLOSED outcome including
    // previously-wrong ASSIGNED/CALLED set by CoinGecko or time-based detection.
    const local = trades.find(t => t.txHash === p.txHash && t.platform === 'RYSK' && t.outcome !== 'CLOSED');
    if (local && local.outcome !== target) { local.outcome = target; changed = true; }
  }
  return changed;
}

async function syncRysk(address) {
  // /api/history is empty for most wallets; /api/user/positions returns all
  // open + expired positions and is the authoritative source.
  let positions = [];

  try {
    positions = await fetchRysk('positions', address);
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error('CORS_BLOCKED');
    }
    throw e;
  }

  const synced      = loadSynced();
  const allTrades   = (positions || []).map(parseRyskTrade).filter(Boolean);
  const openTrades  = allTrades.filter(t => !t.isClose);
  const closeTrades = allTrades.filter(t =>  t.isClose);
  const { added, closedCount, corrected } = applyImportedTrades(trades, openTrades, closeTrades, synced);

  // Resolve outcomes from Rysk oracle settlement prices (authoritative — no CoinGecko needed).
  let posOutcomeChanged = false;
  try {
    posOutcomeChanged = await resolveRyskOutcomes(positions || []);
  } catch (e) {
    // expiry-prices query failed — outcomes stay as EXPIRED; retry on next sync
  }

  if (added + closedCount + corrected > 0 || posOutcomeChanged) {
    save();
    render();
    saveSynced(synced);
  }

  return { imported: added, corrected, skipped: (positions || []).length - allTrades.length };
}

// ── HYPERSURFACE SYNC ─────────────────────────────────────

function parseHsfcSymbol(symbol) {
  // e.g. "HYPE-28MAR26-25-C" or "HYPE-28MAR26-25000-C" (strike may be large for BTC/ETH)
  const parts = symbol.split('-');
  if (parts.length < 4) return null;
  const asset  = symbolToAsset(parts[0]) || parts[0];
  const isPut  = parts[parts.length - 1] === 'P';
  const strike = parseFloat(parts[parts.length - 2]);
  const expiryStr = parts[1];
  const monthMap  = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };
  const day  = parseInt(expiryStr.slice(0, 2));
  const mon  = expiryStr.slice(2, 5).toUpperCase();
  const yr   = parseInt('20' + expiryStr.slice(5));
  const expDate = new Date(Date.UTC(yr, monthMap[mon] ?? 0, day, 8, 0, 0));
  const expiry  = expDate.toISOString().split('T')[0];
  return { asset, isPut, strike, expiry };
}

// Parse one TradeLeg from the Hypersurface subgraph into a trade object.
// trade = parent Trade (has createdTimestamp, createdTransaction, id)
// leg   = TradeLeg (has amount, premium, oToken)
function parseHsfcLeg(trade, leg) {
  const oToken = leg.oToken;
  if (!oToken) return null;

  // oToken.symbol is "HYPE-28MAR26-25-C" format
  const parsed = parseHsfcSymbol(oToken.symbol || '');
  // Fallback: use underlyingAsset.symbol if oToken.symbol parse fails
  const asset = (parsed && parsed.asset) || symbolToAsset((oToken.underlyingAsset && oToken.underlyingAsset.symbol) || '');
  if (!['BTC', 'ETH', 'HYPE', 'SOL'].includes(asset)) return null;

  // strikePrice is at 1e8 per Hypersurface docs ($25 = 2,500,000,000)
  const strike = parseInt(oToken.strikePrice || '0') / 1e8;
  const expiryTs = parseInt(oToken.expiryTimestamp || '0');
  const isPut = oToken.isPut;
  const expiry = (parsed && parsed.expiry) || (expiryTs ? unixToDate(expiryTs) : '');

  // amount at 1e8; negative = sold (wrote option)
  const amount  = parseInt(leg.amount || '0') / 1e8;
  const size    = Math.abs(amount);
  // premium in USDT0 (6 decimals on HyperEVM)
  const rawPrem = parseInt(leg.premium || '0') / 1e6;
  // negative amount (sold) → received premium
  const premium = amount < 0 ? Math.abs(rawPrem) : -Math.abs(rawPrem);

  const createdAt  = parseInt(trade.createdTimestamp || '0');
  const openDate   = createdAt ? unixToDate(createdAt) : today();
  const dte        = (createdAt && expiryTs) ? Math.round((expiryTs - createdAt) / 86400) : null;
  const nowTs      = Math.floor(Date.now() / 1000);
  const outcome    = (expiryTs > 0 && expiryTs < nowTs) ? 'EXPIRED' : 'OPEN';

  // Dedup key: parent trade id + leg id
  const txHash = (trade.createdTransaction || trade.id || '') + '-' + (leg.id || '');

  return {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    asset,
    type:    isPut ? 'PUT' : 'CALL',
    date:    openDate,
    expiry,
    dte,
    strike,
    size,
    premium,
    outcome,
    platform: 'HSFC',
    txHash,
    isClose: amount > 0,  // positive amount = bought back (closing trade)
  };
}

async function fetchHsfcGoldsky(goldskyUrl, gqlBody) {
  if (hasProxy()) {
    const res = await fetch(
      '/api/chain-sync?source=hypersurface&url=' + encodeURIComponent(goldskyUrl),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gqlBody }
    );
    if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
    return res.json();
  }
  // file:// fallback
  const res = await fetch(goldskyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: gqlBody,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Resolve HSFC outcomes from on-chain Position data.
// redeemActions present on a short position → option was exercised → ASSIGNED or CALLED.
// Returns true if any local trade outcome was updated.
function resolveHsfcOutcomes(positions) {
  const nowTs = Math.floor(Date.now() / 1000);
  let changed = false;
  for (const pos of positions) {
    const oToken = pos.oToken;
    if (!oToken) continue;
    const expiryTs = parseInt(oToken.expiryTimestamp || '0');
    if (!expiryTs || expiryTs > nowTs) continue;
    if (!pos.redeemActions || !pos.redeemActions.length) continue;

    const strike = parseInt(oToken.strikePrice || '0') / 1e8;
    const expiry = unixToDate(expiryTs);
    const isPut  = oToken.isPut;
    const asset  = symbolToAsset((oToken.underlyingAsset && oToken.underlyingAsset.symbol) || '');
    if (!['BTC', 'ETH', 'HYPE', 'SOL'].includes(asset)) continue;

    const target = isPut ? 'ASSIGNED' : 'CALLED';
    const local  = trades.find(t =>
      t.platform === 'HSFC' &&
      t.asset    === asset &&
      t.expiry   === expiry &&
      Math.abs(t.strike - strike) < 0.01 &&
      t.type     === (isPut ? 'PUT' : 'CALL') &&
      (t.outcome === 'OPEN' || t.outcome === 'EXPIRED')
    );
    if (local && local.outcome !== target) {
      local.outcome = target;
      changed = true;
    }
  }
  return changed;
}

async function syncHypersurface(address) {
  const goldskyUrl = HSFC_GOLDSKY_URL;
  const addr       = address.toLowerCase();

  let trades_raw = [];

  try {
    const tradesGql = JSON.stringify({
      query: '{ trades(where:{taker:"' + addr + '"}, orderBy:createdTimestamp, orderDirection:desc, first:1000){ id createdTimestamp createdTransaction totalPremium legs { id amount premium oToken { symbol strikePrice expiryTimestamp isPut underlyingAsset { symbol } } } } }'
    });
    const json = await fetchHsfcGoldsky(goldskyUrl, tradesGql);
    if (json.errors) throw new Error(json.errors[0].message || 'GraphQL error');
    trades_raw = (json.data && json.data.trades) || [];
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error('CORS_BLOCKED');
    }
    throw e;
  }

  const synced    = loadSynced();
  const newTrades = [];

  // Each trade can have multiple legs; each leg becomes one trade entry
  for (const trade of trades_raw) {
    for (const leg of (trade.legs || [])) {
      const t = parseHsfcLeg(trade, leg);
      if (!t) continue;
      newTrades.push(t);
    }
  }

  const openTrades  = newTrades.filter(t => !t.isClose);
  const closeTrades = newTrades.filter(t =>  t.isClose);
  const { added, closedCount, corrected } = applyImportedTrades(trades, openTrades, closeTrades, synced);

  // Resolve HSFC outcomes from on-chain Position data (authoritative — no CoinGecko needed).
  // positions(account, amount_lt:"0") = short positions (options the user sold).
  // redeemActions present → option was exercised → ASSIGNED (PUT) or CALLED (CALL).
  let posOutcomeChanged = false;
  try {
    const posGql = JSON.stringify({
      query: '{ positions(where:{account:"' + addr + '", amount_lt:"0"}, first:200) { id oToken { symbol strikePrice expiryTimestamp isPut underlyingAsset { symbol } } redeemActions { id } } }'
    });
    const posJson = await fetchHsfcGoldsky(goldskyUrl, posGql);
    if (posJson.data && posJson.data.positions) {
      posOutcomeChanged = resolveHsfcOutcomes(posJson.data.positions);
    }
  } catch (e) {
    // positions query failed — outcomes stay as EXPIRED; will retry on next sync
  }

  if (added + closedCount + corrected > 0 || posOutcomeChanged) {
    save();
    render();
    saveSynced(synced);
  }

  const totalLegs = trades_raw.reduce((n, t) => n + (t.legs || []).length, 0);
  return { imported: added, closed: closedCount, skipped: totalLegs - newTrades.length };
}

// ── MIGRATION ─────────────────────────────────────────────
// Migration: clean up already-imported negative-premium OPEN trades
// (synced before this fix was deployed).
function migrateCloseTrades() {
  const closers = trades.filter(t => t.premium < 0 && t.outcome === 'OPEN' && t.type !== 'HOLDING');
  if (!closers.length) return;
  let changed = false;
  for (const c of closers) {
    const open = trades.find(t =>
      t.id !== c.id &&
      t.asset   === c.asset &&
      t.type    === c.type &&
      t.expiry  === c.expiry &&
      Math.abs(t.strike - c.strike) < 0.01 &&
      t.premium > 0 &&
      t.outcome === 'OPEN'
    );
    if (open) {
      open.outcome   = 'CLOSED';
      open.closeCost = Math.abs(c.premium);
      trades = trades.filter(t => t.id !== c.id);
      changed = true;
    }
  }
  if (changed) { save(); render(); }
}

// ── OUTCOME AUTO-DETECTION ────────────────────────────────
// After syncing, fetch CoinGecko historical prices for expired trades
// and upgrade EXPIRED → CALLED (call ITM) or ASSIGNED (put ITM).

const _CG_IDS = { BTC: 'bitcoin', ETH: 'ethereum', HYPE: 'hyperliquid', SOL: 'solana' };

async function autoDetectOutcomes(newTrades) {
  const toCheck = newTrades.filter(t =>
    t.outcome === 'EXPIRED' && t.expiry && t.strike > 0 &&
    (t.type === 'CALL' || t.type === 'PUT')
  );
  if (!toCheck.length) return false;

  // Group by unique asset+expiry to minimise API calls
  const keys = [...new Set(toCheck.map(t => t.asset + '|' + t.expiry))];
  const priceCache = {};

  for (const key of keys) {
    const [asset, expiry] = key.split('|');
    const cgId = _CG_IDS[asset];
    if (!cgId) { priceCache[key] = null; continue; }
    const [y, m, d] = expiry.split('-');
    const cgDate = d + '-' + m + '-' + y;
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/coins/' + cgId +
        '/history?date=' + cgDate + '&localization=false'
      );
      if (!res.ok) { priceCache[key] = null; continue; }
      const data = await res.json();
      priceCache[key] = (data.market_data && data.market_data.current_price && data.market_data.current_price.usd) || null;
    } catch (e) {
      priceCache[key] = null;
    }
    // Respect CoinGecko free-tier rate limit
    if (keys.indexOf(key) < keys.length - 1) await new Promise(r => setTimeout(r, 250));
  }

  let changed = false;
  let unresolved = 0;
  for (const t of toCheck) {
    const spot = priceCache[t.asset + '|' + t.expiry];
    if (spot == null) { unresolved++; continue; }
    const trade = trades.find(tr => tr.id === t.id);
    if (!trade || trade.outcome !== 'EXPIRED') continue;
    if (t.type === 'CALL' && spot >= t.strike) { trade.outcome = 'CALLED';   changed = true; }
    if (t.type === 'PUT'  && spot <= t.strike) { trade.outcome = 'ASSIGNED'; changed = true; }
  }
  if (unresolved > 0) {
    toast(unresolved + ' expired option' + (unresolved > 1 ? 's' : '') + ' — verify outcome manually', 'info');
  }
  return changed;
}

// ── AUTO LOAD ──────────────────────────────────────────────

function _setChainStatus(msg, isErr) {
  const el = document.getElementById('footer-sync-time');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isErr ? 'var(--red)' : 'var(--mu2)';
}

async function autoLoadChain(address) {
  if (!address || !address.startsWith('0x')) return;
  migrateCloseTrades();
  _setChainStatus('syncing chain…');

  // Flip any OPEN trades whose expiry date has passed → EXPIRED, then auto-detect outcome
  const todayStr = today();
  const stale = trades.filter(t =>
    t.outcome === 'OPEN' && t.expiry && t.expiry < todayStr &&
    (t.type === 'CALL' || t.type === 'PUT')
  );
  stale.forEach(t => { t.outcome = 'EXPIRED'; });
  if (stale.length) {
    save(); render();
    autoDetectOutcomes(stale).then(changed => { if (changed) { save(); render(); } });
  }

  const [ryskResult, hsfcResult] = await Promise.allSettled([
    syncRysk(address),
    syncHypersurface(address),
  ]);

  const errs = [];
  let totalImported = 0;

  if (ryskResult.status === 'fulfilled') {
    totalImported += (ryskResult.value.imported || 0);
  } else {
    const msg = (ryskResult.reason && ryskResult.reason.message) || String(ryskResult.reason);
    errs.push('Rysk: ' + (msg === 'CORS_BLOCKED' ? 'CORS blocked' : msg));
  }

  if (hsfcResult.status === 'fulfilled') {
    totalImported += (hsfcResult.value.imported || 0);
  } else {
    const msg = (hsfcResult.reason && hsfcResult.reason.message) || String(hsfcResult.reason);
    errs.push('HSFC: ' + (msg === 'CORS_BLOCKED' ? 'CORS blocked' : msg));
  }

  if (errs.length) {
    _setChainStatus(errs.join(' | '), true);
  } else if (totalImported > 0) {
    _setChainStatus('synced ' + totalImported + ' trade' + (totalImported !== 1 ? 's' : ''));
  } else {
    _setChainStatus('chain: 0 new');
  }
}
