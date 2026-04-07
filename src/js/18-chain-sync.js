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
const HSFC_URL_KEY = 'rysk_hsfc_url_v1';

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

function loadHsfcUrl() {
  return localStorage.getItem(HSFC_URL_KEY) || '';
}

function saveHsfcUrl(url) {
  localStorage.setItem(HSFC_URL_KEY, url);
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

  const hsfcInp = document.getElementById('chain-hsfc-url-input');
  if (hsfcInp) hsfcInp.value = loadHsfcUrl();

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
  // isBuy=false → user sold option → received premium (positive)
  // isBuy=true  → user bought option → paid premium (negative)
  const premium = r.isBuy ? -Math.abs(rawPrem) : Math.abs(rawPrem);

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
  let history = [], positions = [];

  try {
    [history, positions] = await Promise.all([
      fetchRysk('history',   address),
      fetchRysk('positions', address).catch(() => []),
    ]);
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error('CORS_BLOCKED');
    }
    throw e;
  }

  const openTxHashes = new Set((positions || []).map(p => p.txHash).filter(Boolean));
  const synced    = loadSynced();
  const newTrades = [];

  for (const r of (history || [])) {
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

  return { imported: newTrades.length, skipped: (history || []).length - newTrades.length };
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

function parseHsfcTrade(r) {
  if (!r.symbol) return null;
  const parsed = parseHsfcSymbol(r.symbol);
  if (!parsed) return null;
  if (!['BTC', 'ETH', 'HYPE', 'SOL'].includes(parsed.asset)) return null;

  // amount at 1e8; negative = sold (wrote option)
  const amount  = parseFloat(r.amount || '0') / 1e8;
  const size    = Math.abs(amount);
  const rawPrem = parseFloat(r.premium || '0');
  // negative amount (sold) → received premium
  const premium = amount < 0 ? Math.abs(rawPrem) : -Math.abs(rawPrem);

  const createdAt  = parseInt(r.timestamp || '0');
  const expiryTs   = r.expiry ? parseInt(r.expiry) : 0;
  const expiryDate = expiryTs ? unixToDate(expiryTs) : parsed.expiry;
  const openDate   = createdAt ? unixToDate(createdAt) : today();
  const dte        = (createdAt && expiryTs) ? Math.round((expiryTs - createdAt) / 86400) : null;

  const nowTs   = Math.floor(Date.now() / 1000);
  const outcome = (expiryTs > 0 && expiryTs < nowTs) ? 'EXPIRED' : 'OPEN';

  return {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    asset:    parsed.asset,
    type:     parsed.isPut ? 'PUT' : 'CALL',
    date:     openDate,
    expiry:   expiryDate,
    dte,
    strike:   parsed.strike,
    size,
    premium,
    outcome,
    notes: 'Hypersurface chain sync',
    platform: 'HSFC',
    txHash: r.transactionHash || r.id || null,
  };
}

async function fetchHsfcGoldsky(goldskyUrl, address) {
  const gql = JSON.stringify({
    query: '{ trades(where:{account:"' + address.toLowerCase() + '"}, orderBy:timestamp, orderDirection:desc, first:1000){ id transactionHash symbol amount premium timestamp expiry account } }'
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
  const goldskyUrl = loadHsfcUrl();
  if (!goldskyUrl) {
    return { imported: 0, skipped: 0, noUrl: true };
  }

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

  for (const r of trades_raw) {
    const key = r.transactionHash || r.id;
    if (key && synced.has(key)) continue;
    const t = parseHsfcTrade(r);
    if (!t) continue;
    newTrades.push(t);
    if (key) synced.add(key);
  }

  if (newTrades.length > 0) {
    newTrades.forEach(t => trades.push(t));
    save();
    render();
    saveSynced(synced);
  }

  return { imported: newTrades.length, skipped: trades_raw.length - newTrades.length };
}

// ── MAIN ENTRY ────────────────────────────────────────────

async function runChainSync() {
  const address = (document.getElementById('chain-wallet-input').value || '').trim();
  if (!address.startsWith('0x') || address.length < 10) return;

  saveWallet(address);

  // Save Goldsky URL if user entered one
  const hsfcInp = document.getElementById('chain-hsfc-url-input');
  if (hsfcInp && hsfcInp.value.trim()) saveHsfcUrl(hsfcInp.value.trim());

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
  hsfcEl.textContent = loadHsfcUrl() ? 'Fetching\u2026' : 'No URL configured';
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
    const { imported, skipped, noUrl } = hsfcResult.value;
    if (noUrl) {
      hsfcEl.textContent = '\u2014 paste Goldsky URL below';
      hsfcEl.style.color = 'var(--mu)';
    } else {
      totalImported += imported;
      hsfcEl.textContent = imported > 0
        ? '\u2713 ' + imported + ' new (' + skipped + ' skipped)'
        : '\u2713 ' + skipped + ' already synced';
      hsfcEl.style.color = 'var(--green)';
    }
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
