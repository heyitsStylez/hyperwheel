// ── OUTCOMES REGISTRY ────────────────────────────────────────
// Single source of truth for trade outcome metadata: display
// labels, badge class, and which platforms allow each outcome.
//
// Lot-lifecycle effects (open/reduce lot, debit/credit P&L) are
// NOT in this registry — they live imperatively in the lot engine
// (04b-lot-engine.js) where the wheel-strategy invariants are
// expressed prose-style.

const OUTCOMES = {
  OPEN:     { title: 'Open',          badge: 'bexp', terminal: false, platforms: ['RYSK','HSFC','SPOT'] },
  EXPIRED:  { title: 'Expired',       badge: 'bexp', terminal: true,  platforms: ['RYSK','HSFC','SPOT'] },
  ASSIGNED: { title: 'Assigned',      badge: 'bass', terminal: true,  platforms: ['RYSK','HSFC','SPOT'] },
  CALLED:   { title: 'Called Away',   badge: 'bcal', terminal: true,  platforms: ['RYSK','HSFC','SPOT'] },
  CLOSED:   { title: 'Closed Early',  badge: 'bexp', terminal: true,  platforms: ['HSFC'] },
};

// Long descriptive label used in the position table. EXPIRED varies
// by trade type (call vs put) so this is type-aware.
function outcomeLabel(t) {
  switch (t.outcome) {
    case 'EXPIRED':  return t.type === 'CALL' ? 'Returned (Kept Asset)' : 'Returned (Kept Premium)';
    case 'ASSIGNED': return 'Assigned (Bought at Strike)';
    case 'CALLED':   return 'Called Away (Sold at Strike)';
    case 'CLOSED':   return 'Closed Early (Bought Back)';
    default:         return t.outcome;
  }
}

function outcomeBadge(outcome) {
  return (OUTCOMES[outcome] && OUTCOMES[outcome].badge) || 'bexp';
}
