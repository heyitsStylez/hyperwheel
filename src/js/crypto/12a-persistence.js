// ── PERSISTENCE SEAM (crypto implementation) ─────────────────
// Core reads and writes trades ONLY through this seam:
//   loadTrades(): Promise<Trade[]>
//   persist(trades): Promise<void>
//   currentUserKey(): string
// Async from day one (see #84) so a phase-2 server backend can slot
// in without churning core. A second app can swap this file for its own storage.
// The crypto implementation wraps hw_holdings (localStorage) + debounced cloud push.

async function loadTrades() {
  try {
    return JSON.parse(localStorage.getItem(HW_HOLDINGS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

async function persist(t) {
  localStorage.setItem(HW_HOLDINGS_KEY, JSON.stringify(t));
  if (typeof scheduleCloudPush === 'function') scheduleCloudPush();
}

function currentUserKey() {
  return loadWallet();
}
