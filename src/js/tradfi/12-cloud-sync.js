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
      '<button class="btn btn-g" onclick="wheelerSignOut()">[ SIGN OUT ]</button>';
  } else {
    el.innerHTML =
      '<button class="btn btn-p" onclick="wheelerSignIn()">[ SIGN IN WITH GOOGLE ]</button>';
    _setCloudStatus('');
  }
}

function wheelerSignIn()  { window.location = '/api/auth/google'; }
function wheelerSignOut() { window.location = '/api/auth/google?action=logout'; }

// Union-merge local + remote trade arrays by `id`. A trade present on only one
// side is always kept, so a cloud pull can never silently drop a locally-entered
// trade. On a shared id, the side with the newer savedAt wins, preserving
// edit last-write-wins. NOTE: deletions do not propagate — an accepted tradeoff
// vs. silent data loss (see ADR 0007). Pure; dual-exported for Node tests.
function mergeTradesById(local, remote, preferRemote) {
  const byId   = new Map();
  const winner = preferRemote ? remote : local;
  const loser  = preferRemote ? local  : remote;
  for (const t of loser)  byId.set(t.id, t);
  for (const t of winner) byId.set(t.id, t);  // winner overwrites on shared id
  return [...byId.values()];
}

// Stable content fingerprint (id-sorted) so we only save/push when something
// actually changed, avoiding needless writes and cross-device push loops.
function _tradesFingerprint(arr) {
  return JSON.stringify([...arr].sort((a, b) => (a.id || 0) - (b.id || 0)));
}

// Boot-time: learn auth state, then reconcile local and remote by merging both
// (never replacing) so no trade is lost, and converge whichever store is behind.
async function authInit() {
  try {
    const r = await fetch('/api/wheeler-sync');
    if (!r.ok) throw new Error();
    const data = await r.json();
    if (!data.authed) { _setAuthUI(false); return; }
    _setAuthUI(true, data.email);

    const remote   = Array.isArray(data.trades) ? data.trades : [];
    const remoteTs = data.savedAt || 0;
    const localTs  = parseInt(localStorage.getItem(WHEELER_CLOUD_TS) || '0');
    const merged   = mergeTradesById(trades, remote, remoteTs > localTs);

    const localIds = new Set(trades.map(t => t.id));
    const gained   = merged.filter(t => !localIds.has(t.id)).length;
    const mergedFp = _tradesFingerprint(merged);

    if (mergedFp !== _tradesFingerprint(trades)) {
      _suppressPush = true;
      trades = merged;
      save();
      render();
      _suppressPush = false;
    }

    if (mergedFp !== _tradesFingerprint(remote)) {
      scheduleCloudPush();  // push local-only trades up; cloudPush sets the ts
    } else {
      localStorage.setItem(WHEELER_CLOUD_TS, String(Math.max(remoteTs, localTs)));
    }

    if (gained > 0 && typeof toast === 'function') {
      toast('Pulled ' + gained + ' trade' + (gained === 1 ? '' : 's') + ' from cloud', 'info');
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeTradesById };
}
