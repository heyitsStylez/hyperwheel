// ── CLOUD SYNC (Wheeler / tradfi) ────────────────────────────
// Design B (#110, ADR 0007): local-first. localStorage stays the working store;
// signing in with Google enables per-user push/pull of the FULL trade array to
// KV keyed by the session `sub` (server-side). Mirrors crypto's cloud-sync.
let _pushTimer    = null;
let _suppressPush = false;
let _wheelerAuthed = false;
const WHEELER_CLOUD_TS = 'wheeler_cloud_ts';

function _setCloudStatus(s) {
  const el = document.getElementById('footer-cloud');
  if (!el) return;
  if      (s === 'push') { el.textContent = '↑'; el.style.color = 'var(--mu2)'; }
  else if (s === 'pull') { el.textContent = '↓'; el.style.color = 'var(--mu2)'; }
  else if (s === 'ok')   { el.textContent = '●'; el.style.color = 'var(--green)'; }
  else if (s === 'err')  { el.textContent = '!'; el.style.color = 'var(--red)'; }
  else                   { el.textContent = '';  }
}

function _setAuthUI(authed, email) {
  _wheelerAuthed = authed;
  const el = document.getElementById('wheeler-auth');
  if (!el) return;
  if (authed) {
    el.innerHTML =
      '<span class="wheeler-auth-email" title="' + (email || '') + '">' + (email || 'signed in') + '</span>' +
      '<button class="btn" onclick="wheelerSignOut()">[ SIGN OUT ]</button>';
  } else {
    el.innerHTML =
      '<button class="btn btn-p" onclick="wheelerSignIn()">[ SIGN IN WITH GOOGLE ]</button>';
    _setCloudStatus('');
  }
}

function wheelerSignIn()  { window.location = '/api/auth/google'; }
function wheelerSignOut() { window.location = '/api/auth/google?action=logout'; }

// Boot-time: learn auth state, then either pull newer remote data or back up
// local trades (first-login migration) if signed in.
async function authInit() {
  try {
    const r = await fetch('/api/wheeler-sync');
    if (!r.ok) throw new Error();
    const data = await r.json();
    if (!data.authed) { _setAuthUI(false); return; }
    _setAuthUI(true, data.email);

    const remoteTs = data.savedAt || 0;
    const localTs  = parseInt(localStorage.getItem(WHEELER_CLOUD_TS) || '0');
    if (Array.isArray(data.trades) && data.trades.length > 0 && remoteTs > localTs) {
      _suppressPush = true;
      trades = data.trades;
      localStorage.setItem(WHEELER_CLOUD_TS, String(remoteTs));
      save();
      render();
      _suppressPush = false;
      if (typeof toast === 'function') {
        toast('Pulled ' + data.trades.length + ' trade' + (data.trades.length === 1 ? '' : 's') + ' from cloud', 'info');
      }
    } else {
      scheduleCloudPush();  // back up local trades to the freshly-signed-in account
    }
    _setCloudStatus('ok');
  } catch {
    _setAuthUI(false);
  }
}

async function cloudPush() {
  if (!_wheelerAuthed) return;
  _setCloudStatus('push');
  try {
    const savedAt = Date.now();
    const r = await fetch('/api/wheeler-sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ trades, savedAt }),
    });
    if (!r.ok) throw new Error();
    localStorage.setItem(WHEELER_CLOUD_TS, String(savedAt));
    _setCloudStatus('ok');
  } catch {
    _setCloudStatus('err');
    if (typeof toast === 'function') toast('Cloud sync failed', 'err');
  }
}

function scheduleCloudPush() {
  if (_suppressPush || !_wheelerAuthed) return;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(cloudPush, 300);
}
