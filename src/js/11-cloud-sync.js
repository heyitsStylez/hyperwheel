// ═══════════════════════════════════════════════════════════
// CLOUD SYNC
// ═══════════════════════════════════════════════════════════

function getSyncCode() {
  let code = localStorage.getItem(SYNC_CODE_KEY);
  if (!code) {
    code = crypto.randomUUID();
    localStorage.setItem(SYNC_CODE_KEY, code);
  }
  return code;
}

function showSync() {
  const code = getSyncCode();
  document.getElementById('sync-code-display').textContent = code;
  const lastPushed = localStorage.getItem(SYNC_LAST_KEY);
  document.getElementById('sync-last-pushed').textContent = lastPushed
    ? 'Last pushed: ' + new Date(lastPushed).toUTCString()
    : 'Never synced';
  cloudPullData = null;
  syncCodeChangeVisible = false;
  document.getElementById('sync-pull-preview').style.display = 'none';
  document.getElementById('sync-status').style.display = 'none';
  document.getElementById('sync-code-change').style.display = 'none';
  document.getElementById('sync-overlay').classList.add('open');
}

function closeSync() {
  document.getElementById('sync-overlay').classList.remove('open');
}

function copySyncCode() {
  const code = document.getElementById('sync-code-display').textContent;
  navigator.clipboard.writeText(code).then(function() {
    const btn = document.getElementById('sync-copy-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--gb)';
    setTimeout(function() {
      btn.textContent = orig;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1800);
  });
}

function toggleSyncCodeChange() {
  syncCodeChangeVisible = !syncCodeChangeVisible;
  const el = document.getElementById('sync-code-change');
  el.style.display = syncCodeChangeVisible ? 'flex' : 'none';
  if (syncCodeChangeVisible) document.getElementById('sync-code-input').focus();
}

function applySyncCode() {
  const input = document.getElementById('sync-code-input').value.trim().toLowerCase();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!uuidRe.test(input)) {
    setSyncMsg('Invalid code — must be a UUID like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'err');
    return;
  }
  localStorage.setItem(SYNC_CODE_KEY, input);
  document.getElementById('sync-code-display').textContent = input;
  document.getElementById('sync-code-input').value = '';
  document.getElementById('sync-code-change').style.display = 'none';
  syncCodeChangeVisible = false;
  setSyncMsg('Sync code updated. Pull from cloud to load your trades.', 'ok');
}

async function syncPush() {
  const code = getSyncCode();
  const btn = document.getElementById('sync-push-btn');
  btn.disabled = true;
  btn.textContent = 'Pushing...';
  setSyncMsg('', '');
  cloudPullData = null;
  document.getElementById('sync-pull-preview').style.display = 'none';
  try {
    const payload = {
      version: 1,
      app: 'hyperwheel-tracker',
      exported: new Date().toISOString(),
      tradeCount: trades.length,
      trades: trades
    };
    const res = await fetch('/api/sync?code=' + code, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Push failed');
    const now = new Date().toISOString();
    localStorage.setItem(SYNC_LAST_KEY, now);
    document.getElementById('sync-last-pushed').textContent = 'Last pushed: ' + new Date(now).toUTCString();
    setSyncMsg('Pushed ' + trades.length + ' trade' + (trades.length !== 1 ? 's' : '') + ' to cloud.', 'ok');
  } catch(e) {
    setSyncMsg('Push failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '\u2191 Push to Cloud';
  }
}

async function syncPull() {
  const code = getSyncCode();
  const btn = document.getElementById('sync-pull-btn');
  btn.disabled = true;
  btn.textContent = 'Pulling...';
  setSyncMsg('', '');
  cloudPullData = null;
  document.getElementById('sync-pull-preview').style.display = 'none';
  try {
    const res = await fetch('/api/sync?code=' + code);
    if (res.status === 404) {
      setSyncMsg('No data found in cloud for this sync code. Push first from another browser.', 'err');
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Pull failed');
    }
    const data = await res.json();
    const importedTrades = Array.isArray(data) ? data : (data.trades || []);
    if (!Array.isArray(importedTrades) || importedTrades.length === 0) {
      setSyncMsg('Cloud data is empty.', 'err');
      return;
    }
    cloudPullData = importedTrades;
    const existingIds = new Set(trades.map(function(t) { return t.id; }));
    const newCount = importedTrades.filter(function(t) { return !existingIds.has(t.id); }).length;
    const dupCount = importedTrades.length - newCount;
    document.getElementById('sync-pull-info').innerHTML =
      '<strong style="color:var(--text)">' + importedTrades.length + ' trades in cloud</strong><br>' +
      '<span style="color:var(--green)">' + newCount + ' new</span>' +
      ' &nbsp;|&nbsp; <span style="color:var(--mu2)">' + dupCount + ' already in tracker</span><br>' +
      '<span style="color:var(--mu)">Currently in tracker: ' + trades.length + '</span>';
    document.getElementById('sync-pull-preview').style.display = 'flex';
  } catch(e) {
    setSyncMsg('Pull failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '\u2193 Pull from Cloud';
  }
}

function doCloudImport(mode) {
  if (!cloudPullData) return;
  if (mode === 'replace') {
    trades = cloudPullData;
    setSyncMsg('Replaced all trades. ' + trades.length + ' trade' + (trades.length !== 1 ? 's' : '') + ' loaded from cloud.', 'ok');
  } else {
    const existingIds = new Set(trades.map(function(t) { return t.id; }));
    const toAdd = cloudPullData.filter(function(t) { return !existingIds.has(t.id); });
    trades = trades.concat(toAdd);
    trades.sort(function(a, b) { return a.date.localeCompare(b.date) || a.id - b.id; });
    setSyncMsg('Merged ' + toAdd.length + ' new trade' + (toAdd.length !== 1 ? 's' : '') + '. ' + (cloudPullData.length - toAdd.length) + ' duplicate(s) skipped.', 'ok');
  }
  save();
  render();
  cloudPullData = null;
  document.getElementById('sync-pull-preview').style.display = 'none';
}

function setSyncMsg(msg, type) {
  const el = document.getElementById('sync-status');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg;
  el.className = 'sync-status ' + type;
  el.style.display = 'block';
}

document.getElementById('sync-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeSync();
});
