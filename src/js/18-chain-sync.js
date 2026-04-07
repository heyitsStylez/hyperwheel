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
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || '[]')); } catch (e) { return new Set(); }
}

function saveSynced(set) {
  localStorage.setItem(SYNCED_KEY, JSON.stringify([...set]));
}

function loadWallet() {
  return localStorage.getItem(WALLET_KEY) || '';
}

function saveWallet(addr) {
  localStorage.setItem(WALLET_KEY, addr);
}

// Returns true when running under a real web server (Vercel or local http.server)
// so the /api/chain-sync proxy is available.
function hasProxy() {
  return window.location.protocol !== 'file:';
}

// ── MODAL ─────────────────────────────────────────────────

function openChainSyncModal() {
  const ov = document.getElementById('chain-sync-overlay');
  ov.style.display = 'flex';

  const saved = loadWallet();
  const walletInp = document.getElementById('chain-wallet-input');
  walletInp.value = saved;
  document.getElementById('chain-sync-run-btn').disabled = !saved.startsWith('0x');

  // Reset status
  const statusEl  = document.getElementById('chain-sync-status');
  const summaryEl = document.getElementById('cs-summary');
  statusEl.style.display  = 'none';
  summaryEl.style.display = 'none';
  document.getElementById('cs-rysk-status').textContent = '—';
  document.getElementById('cs-hsfc-status').textContent = '—';
  document.getElementById('cs-rysk-status').style.color = 'var(--mu)';
  document.getElementById('cs-hsfc-status').style.color = 'var(--mu)';

  requestAnimationFrame(() => ov.classList.add('open'));
}

function closeChainSyncModal() {
  const ov = document.getElementById('chain-sync-overlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 180);
}

// ── RYSK SYNC ─────────────────────────────────────────────

function parseRyskTrade(r, openTxHashes) {
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

  const nowTs = Math.floor(Date.now() / 1000);
  let outcome = 'OPEN';
  if (r.txHash && openTxHashes.has(r.txHash)) {
    outcome = 'OPEN';
  } else if (expiryTs > 0 && expiryTs < nowTs) {
    outcome = 'EXPIRED';
  }

  return {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    asset,
    type:   r.isPut ? 'PUT' : 'CALL',
    date:   createdAt ? unixToDate(createdAt) : today(),
    expiry: expiryTs  ? unixToDate(expiryTs)  : '',
    dte:    dte > 0 ? dte : null,
    strike,
    size,
    premium,
    outcome,
    notes: 'Rysk chain sync',
    platform: 'RYSK',
    txHash: r.txHash || null,
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

  // All returned positions are "open" from the positions endpoint perspective
  const openTxHashes = new Set((positions || []).map(p => p.txHash).filter(Boolean));
  const synced    = loadSynced();
  const newTrades = [];

  for (const r of (positions || [])) {
    if (r.txHash && synced.has(r.txHash)) continue;
    const t = parseRyskTrade(r, openTxHashes);
    if (!t) continue;
    newTrades.push(t);
    if (r.txHash) synced.add(r.txHash);
  }

  if (newTrades.length > 0) {
    newTrades.forEach(t => trades.push(t));
    save();
    render();
    saveSynced(synced);
  }

  return { imported: newTrades.length, skipped: (positions || []).length - newTrades.length };
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
    type:   isPut ? 'PUT' : 'CALL',
    date:   openDate,
    expiry,
    dte,
    strike,
    size,
    premium,
    outcome,
    notes: 'Hypersurface chain sync',
    platform: 'HSFC',
    txHash,
  };
}

async function fetchHsfcGoldsky(goldskyUrl, address) {
  // Real schema: Trade → legs[] → oToken { symbol strikePrice expiryTimestamp isPut }
  // Filter by taker (the user's address, stored lowercase in the subgraph)
  const gql = JSON.stringify({
    query: '{ trades(where:{taker:"' + address.toLowerCase() + '"}, orderBy:createdTimestamp, orderDirection:desc, first:1000){ id createdTimestamp createdTransaction totalPremium legs { id amount premium oToken { symbol strikePrice expiryTimestamp isPut underlyingAsset { symbol } } } } }'
  });

  if (hasProxy()) {
    const res = await fetch(
      '/api/chain-sync?source=hypersurface&url=' + encodeURIComponent(goldskyUrl),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gql }
    );
    if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
    return res.json();
  }
  // file:// fallback
  const res = await fetch(goldskyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: gql,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function syncHypersurface(address) {
  const goldskyUrl = HSFC_GOLDSKY_URL;

  let trades_raw = [];

  try {
    const json = await fetchHsfcGoldsky(goldskyUrl, address);
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
      const key = (trade.createdTransaction || trade.id || '') + '-' + (leg.id || '');
      if (key && synced.has(key)) continue;
      const t = parseHsfcLeg(trade, leg);
      if (!t) continue;
      newTrades.push(t);
      if (key) synced.add(key);
    }
  }

  if (newTrades.length > 0) {
    newTrades.forEach(t => trades.push(t));
    save();
    render();
    saveSynced(synced);
  }

  const totalLegs = trades_raw.reduce((n, t) => n + (t.legs || []).length, 0);
  return { imported: newTrades.length, skipped: totalLegs - newTrades.length };
}

// ── MAIN ENTRY ────────────────────────────────────────────

async function runChainSync() {
  const address = (document.getElementById('chain-wallet-input').value || '').trim();
  if (!address.startsWith('0x') || address.length < 10) return;

  saveWallet(address);

  const btn = document.getElementById('chain-sync-run-btn');
  btn.disabled    = true;
  btn.textContent = 'Syncing\u2026';

  const statusEl  = document.getElementById('chain-sync-status');
  const ryskEl    = document.getElementById('cs-rysk-status');
  const hsfcEl    = document.getElementById('cs-hsfc-status');
  const summaryEl = document.getElementById('cs-summary');

  statusEl.style.display  = 'block';
  summaryEl.style.display = 'none';
  ryskEl.textContent = 'Fetching\u2026';
  ryskEl.style.color = 'var(--mu)';
  hsfcEl.textContent = 'Fetching\u2026';
  hsfcEl.style.color = 'var(--mu)';

  const [ryskResult, hsfcResult] = await Promise.allSettled([
    syncRysk(address),
    syncHypersurface(address),
  ]);

  let totalImported = 0;
  let hasError = false;

  if (ryskResult.status === 'fulfilled') {
    const { imported, skipped } = ryskResult.value;
    totalImported += imported;
    ryskEl.textContent = imported > 0
      ? '\u2713 ' + imported + ' new (' + skipped + ' skipped)'
      : '\u2713 ' + skipped + ' already synced';
    ryskEl.style.color = 'var(--green)';
  } else {
    const msg = ryskResult.reason && ryskResult.reason.message;
    ryskEl.textContent = msg === 'CORS_BLOCKED'
      ? '\u26A0 CORS \u2014 open via http.server 8080'
      : '\u2717 ' + (msg || 'Failed');
    ryskEl.style.color = 'var(--red)';
    hasError = true;
  }

  if (hsfcResult.status === 'fulfilled') {
    const { imported, skipped } = hsfcResult.value;
    totalImported += imported;
    hsfcEl.textContent = imported > 0
      ? '\u2713 ' + imported + ' new (' + skipped + ' skipped)'
      : '\u2713 ' + skipped + ' already synced';
    hsfcEl.style.color = 'var(--green)';
  } else {
    const msg = hsfcResult.reason && hsfcResult.reason.message;
    hsfcEl.textContent = msg === 'CORS_BLOCKED'
      ? '\u26A0 CORS \u2014 open via http.server 8080'
      : '\u2717 ' + (msg || 'Failed');
    hsfcEl.style.color = 'var(--red)';
    hasError = true;
  }

  summaryEl.style.display = 'block';
  if (totalImported > 0) {
    summaryEl.textContent = 'Imported ' + totalImported + ' new trade' + (totalImported !== 1 ? 's' : '') + '.';
    summaryEl.style.color = 'var(--green)';
  } else if (!hasError) {
    summaryEl.textContent = 'All trades already synced.';
    summaryEl.style.color = 'var(--mu)';
  } else {
    summaryEl.textContent = 'One or more sources failed.';
    summaryEl.style.color = 'var(--mu2)';
  }

  btn.disabled    = false;
  btn.textContent = 'Sync';

  if (!hasError && totalImported === 0) {
    setTimeout(closeChainSyncModal, 2000);
  }
}
