// ── CLOUD SYNC (Vercel KV, keyed by wallet) ──────────────────
let _pushTimer    = null;
let _suppressPush = false;

function _setCloudStatus(s) {
  const el = document.getElementById('footer-cloud');
  if (!el) return;
  if      (s === 'push') { el.textContent = '↑'; el.style.color = 'var(--mu2)'; }
  else if (s === 'pull') { el.textContent = '↓'; el.style.color = 'var(--mu2)'; }
  else if (s === 'ok')   { el.textContent = '●'; el.style.color = 'var(--green)'; }
  else if (s === 'err')  { el.textContent = '!'; el.style.color = 'var(--red)'; }
}

async function cloudPush() {
  const wallet = loadWallet();
  if (!wallet) return;
  _setCloudStatus('push');
  try {
    const savedAt  = Date.now();
    const holdings = trades.filter(t => t.type === 'HOLDING');
    const r = await fetch('/api/sync?wallet=' + encodeURIComponent(wallet), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ holdings, savedAt }),
    });
    if (!r.ok) throw new Error();
    localStorage.setItem('hw_cloud_ts', String(savedAt));
    _setCloudStatus('ok');
  } catch {
    _setCloudStatus('err');
    if (typeof toast === 'function') toast('Cloud sync failed', 'err');
  }
}

function scheduleCloudPush() {
  if (_suppressPush) return;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(cloudPush, 300);
}

async function cloudPull() {
  const wallet = loadWallet();
  if (!wallet) return;
  _setCloudStatus('pull');
  try {
    const r = await fetch('/api/sync?wallet=' + encodeURIComponent(wallet));
    if (!r.ok) throw new Error();
    const data     = await r.json();
    const remoteTs = data.savedAt || 0;
    const localTs  = parseInt(localStorage.getItem('hw_cloud_ts') || '0');
    if (Array.isArray(data.holdings) && data.holdings.length > 0 && remoteTs > localTs) {
      _suppressPush = true;
      trades = trades.filter(t => t.type !== 'HOLDING');
      trades.push(...data.holdings);
      localStorage.setItem('hw_cloud_ts', String(remoteTs));
      save();
      render();
      _suppressPush = false;
      if (typeof toast === 'function') toast('Pulled ' + data.holdings.length + ' holding' + (data.holdings.length === 1 ? '' : 's') + ' from cloud', 'info');
    }
    _setCloudStatus('ok');
  } catch {
    _setCloudStatus('err');
    if (typeof toast === 'function') toast('Cloud pull failed', 'err');
  }
}
