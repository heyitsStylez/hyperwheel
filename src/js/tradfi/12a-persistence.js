// ── PERSISTENCE SEAM (tradfi / Wheeler implementation) ────────
// Core reads and writes trades ONLY through this seam:
//   loadTrades(): Promise<Trade[]>
//   persist(trades): Promise<void>
//   currentUserKey(): string
// Local-first (#84, #110): trades live in localStorage under wheeler_trades.
// When signed in with Google (phase 2, ADR 0007), persist() also debounce-pushes
// the full array to per-user KV — HyperWheel's hw_holdings key is untouched.
const WHEELER_TRADES_KEY = 'wheeler_trades';

async function loadTrades() {
  try {
    return JSON.parse(localStorage.getItem(WHEELER_TRADES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

async function persist(t) {
  localStorage.setItem(WHEELER_TRADES_KEY, JSON.stringify(t));
  if (typeof scheduleCloudPush === 'function') scheduleCloudPush();
}

function currentUserKey() {
  return 'local';
}
