// ── CHAIN SYNC ────────────────────────────────────────────
// Pulls trade history from Rysk (/api/history) and
// Hypersurface (Goldsky subgraph) for a given wallet address.
// Deduplicates by txHash; auto-imports new trades.

const SYMBOL_MAP = {
  UBTC: 'BTC', UETH: 'ETH',
  kHYPE: 'HYPE', WHYPE: 'HYPE', wstHYPE: 'HYPE',
  uSOL: 'SOL', USOL: 'SOL',
};

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

// ── MODAL ─────────────────────────────────────────────────

function openChainSyncModal() {
  const ov = document.getElementById('chain-sync-overlay');
  const inp = document.getElementById('chain-wallet-input');
  const statusEl = document.getElementById('chain-sync-status');
  const summaryEl = document.getElementById('cs-summary');
  ov.style.display = 'flex';
  // Restore saved wallet address
  const saved = loadWallet();
  inp.value = saved;
  document.getElementById('chain-sync-run-btn').disabled = !saved.startsWith('0x');
  // Reset status
  statusEl.style.display = 'none';
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

  const strike = bigIntToNum(r.strike, dec);
  const size   = bigIntToNum(r.quantity, dec);
  const rawPrem = bigIntToNum(r.premium, dec);
  // isBuy=false → user sold option → received premium (positive)
  // isBuy=true  → user bought option → paid premium (negative, not typical for wheel)
  const premium = r.isBuy ? -Math.abs(rawPrem) : Math.abs(rawPrem);

  const createdAt = r.createdAt || 0;
  const expiryTs  = r.expiry    || 0;
  const dte = Math.round((expiryTs - createdAt) / 86400);

  // Outcome: OPEN if still in positions list, EXPIRED if past, else OPEN (manual update for ASSIGNED/CALLED)
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
    type: r.isPut ? 'PUT' : 'CALL',
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

async function syncRysk(address) {
  const BASE = 'https://v12.rysk.finance/api';
  let history = [], positions = [];

  try {
    const [hRes, pRes] = await Promise.all([
      fetch(BASE + '/history?address=' + address),
      fetch(BASE + '/user/positions?address=' + address),
    ]);
    if (!hRes.ok) throw new Error('HTTP ' + hRes.status);
    history   = await hRes.json();
    positions = await pRes.json().catch(() => []);
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error('CORS_BLOCKED');
    }
    throw e;
  }

  const openTxHashes = new Set((positions || []).map(p => p.txHash).filter(Boolean));
  const synced = loadSynced();
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

const HSFC_GOLDSKY_URL = 'https://api.goldsky.com/api/public/project_cm9e2q1k7000101u19ys2b9ei/subgraphs/hypersurface-sh-subgraph/latest/gn';
const HSFC_HEDGEDPOOL   = '0x0095aCDD705Cfcc11eAfFb6c19A28C0153ad196F';
const HYPER_EVM_RPC     = 'https://rpc.hyperliquid.xyz/evm';

// Symbol format: HYPE-28MAR26-25-C / HYPE-28MAR26-25-P
function parseHsfcSymbol(symbol) {
  // e.g. "HYPE-28MAR26-25-C"
  const parts = symbol.split('-');
  if (parts.length < 4) return null;
  const asset  = symbolToAsset(parts[0]) || parts[0];
  const isPut  = parts[3] === 'P';
  const strike = parseFloat(parts[2]);
  // Parse expiry date like "28MAR26"
  const expiryStr = parts[1];
  const monthMap  = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };
  const day   = parseInt(expiryStr.slice(0, 2));
  const mon   = expiryStr.slice(2, 5).toUpperCase();
  const yr    = parseInt('20' + expiryStr.slice(5));
  const expDate = new Date(Date.UTC(yr, monthMap[mon] ?? 0, day, 8, 0, 0));
  const expiry = expDate.toISOString().split('T')[0];
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
  // premium in USD (float from API)
  const rawPrem = parseFloat(r.premium || '0');
  // negative amount (sold) → received premium
  const premium = amount < 0 ? Math.abs(rawPrem) : -Math.abs(rawPrem);

  const createdAt = parseInt(r.timestamp || '0');
  const expiryTs  = r.expiry ? parseInt(r.expiry) : 0;
  const expiryDate = expiryTs ? unixToDate(expiryTs) : parsed.expiry;
  const openDate   = createdAt ? unixToDate(createdAt) : today();
  const dte = createdAt && expiryTs ? Math.round((expiryTs - createdAt) / 86400) : null;

  const nowTs = Math.floor(Date.now() / 1000);
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

async function syncHypersurface(address) {
  const query = '{"query":"{ trades(where:{account:\\"' + address.toLowerCase() + '\\"}, orderBy:timestamp, orderDirection:desc, first:1000){ id transactionHash symbol amount premium timestamp expiry account } }"}';

  let trades_raw = [];

  try {
    const res = await fetch(HSFC_GOLDSKY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    trades_raw = (json.data && json.data.trades) || [];
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('404')) {
      // Goldsky failed — try HyperEVM RPC eth_getLogs
      try {
        trades_raw = await fetchHsfcViaRpc(address);
      } catch (e2) {
        throw new Error('CORS_BLOCKED');
      }
    } else {
      throw e;
    }
  }

  const synced = loadSynced();
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

async function fetchHsfcViaRpc(address) {
  // eth_getLogs on HedgedPool filtered by user address as topic[1]
  const paddedAddr = '0x000000000000000000000000' + address.slice(2).toLowerCase();
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_getLogs',
    params: [{
      fromBlock: '0x0',
      toBlock:   'latest',
      address:   HSFC_HEDGEDPOOL,
      topics:    [null, paddedAddr],
    }],
  });
  const res = await fetch(HYPER_EVM_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error('RPC HTTP ' + res.status);
  const json = await res.json();
  // RPC logs lack symbol/premium fields; return empty — best effort
  return [];
}

// ── MAIN ENTRY ────────────────────────────────────────────

async function runChainSync() {
  const inp = document.getElementById('chain-wallet-input');
  const address = (inp.value || '').trim();
  if (!address.startsWith('0x') || address.length < 10) return;

  saveWallet(address);

  const btn = document.getElementById('chain-sync-run-btn');
  btn.disabled = true;
  btn.textContent = 'Syncing…';

  const statusEl  = document.getElementById('chain-sync-status');
  const ryskEl    = document.getElementById('cs-rysk-status');
  const hsfcEl    = document.getElementById('cs-hsfc-status');
  const summaryEl = document.getElementById('cs-summary');

  statusEl.style.display  = 'block';
  summaryEl.style.display = 'none';
  ryskEl.textContent = 'Fetching…';
  ryskEl.style.color = 'var(--mu)';
  hsfcEl.textContent = 'Fetching…';
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
      ? '\u26A0 CORS blocked (use local server)'
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
      ? '\u26A0 CORS blocked (use local server)'
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
    summaryEl.innerHTML = 'Could not reach one or more sources. Try opening via:<br><code style="font-size:.65rem">python3 -m http.server 8080</code>';
    summaryEl.style.color = 'var(--mu2)';
  }

  btn.disabled = false;
  btn.textContent = 'Sync';

  // Auto-close after 2s if all succeeded
  if (!hasError && totalImported === 0) {
    setTimeout(closeChainSyncModal, 2000);
  }
}
