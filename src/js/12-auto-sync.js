// ═══════════════════════════════════════════════════════════
// AUTO SYNC
// ═══════════════════════════════════════════════════════════

function scheduleAutoSync() {
  if (!localStorage.getItem(SYNC_LAST_KEY)) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(autoSyncPush, 2000);
}

async function autoSyncPush() {
  const code = localStorage.getItem(SYNC_CODE_KEY);
  if (!code) return;
  setAutoSyncStatus('syncing');
  try {
    const payload = {
      version: 1, app: 'hyperwheel-tracker',
      exported: new Date().toISOString(),
      tradeCount: trades.length, trades: trades
    };
    const res = await fetch('/api/sync?code=' + code, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error();
    localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString());
    setAutoSyncStatus('ok');
  } catch(e) {
    setAutoSyncStatus('err');
  }
}

function setAutoSyncStatus(state) {
  const el = document.getElementById('auto-sync-status');
  if (!el) return;
  clearTimeout(el._hideTimer);
  if (state === 'syncing') {
    el.textContent = '\u21bb Syncing';
    el.style.color = 'var(--mu)';
  } else if (state === 'ok') {
    el.textContent = '\u2713 Synced';
    el.style.color = 'var(--green)';
    el._hideTimer = setTimeout(function() { el.textContent = ''; }, 3000);
  } else {
    el.textContent = '\u26a0 Sync failed';
    el.style.color = 'var(--red)';
    el._hideTimer = setTimeout(function() { el.textContent = ''; }, 5000);
  }
}
