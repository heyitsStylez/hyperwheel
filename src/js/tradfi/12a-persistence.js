// ── PERSISTENCE SEAM (tradfi / Wheeler implementation) ────────
// Core reads and writes trades ONLY through this seam:
//   loadTrades(): Promise<Trade[]>
//   persist(trades): Promise<void>
//   currentUserKey(): string
// Wheeler v1 is local-only and single-user-per-device (#84): trades live in
// localStorage under wheeler_trades, and currentUserKey() is the constant
// 'local'. Async from day one so a phase-2 server backend slots in without
// churning core — HyperWheel's hw_holdings key is untouched.
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
}

function currentUserKey() {
  return 'local';
}
