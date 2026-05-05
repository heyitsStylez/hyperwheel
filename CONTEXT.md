# CONTEXT — HyperWheel Domain Glossary

The vocabulary of the wheel-strategy accounting model. Use these terms (and only
these terms) when naming modules, writing tests, or describing behaviour.

## Core terms

### Wheel
A repeating cash-secured-put → assignment → covered-call → call-away cycle on a
single underlying asset. The user runs **one or more wheels per asset** —
multiple open lots can coexist (e.g. two BTC lots from two separate
assignments).

### Lot
A unit of underlying tokens acquired through one of two paths:
- **HOLDING** — bought spot
- **ASSIGNED** — acquired by having a sold PUT assigned

A Lot tracks `costBasis`, `size` (current, after partial call-aways),
`lotPremiums` (call premiums collected against this lot), `startDate`, and
once closed, `endDate` + `exitStrike`. A lot is **open** until the entire
`size` is called away by CALLED outcomes.

### Net cost
The effective cost basis of a Lot after subtracting accumulated premiums:

```
netCost = costBasis − (lotPremiums / size)
```

This is the user's headline metric — "what did I really pay per token after the
premium has worked for me?"

### Assigned PUT premium credit
When a sold PUT is assigned, the put's net premium **must be credited to the
new Lot's `lotPremiums`** — not just to portfolio P&L. This makes the put
behave symmetrically with subsequent calls in reducing net cost.

This was historically a bug; it is now the engine's invariant.

### Lot premiums
The running total of net premiums (premium − closeCost) collected against a
single Lot. Includes the premium of the originating assigned PUT (see above)
plus every CALL written against the lot. Used for net-cost arithmetic.

### Realised P&L
The user-facing settled-events P&L, computed under a **cash-flow lens**:

```
realised = Σ (netPrem of every settled non-HOLDING trade)
         + Σ over CALLED events of (strike − costBasis) × calledSize
```

Open options and open lots contribute zero. CLOSED CALLs with `closeCost >
premium` go negative cleanly (no special case). HOLDING-originated and
ASSIGNED-originated lots realise capital gain symmetrically on call-away — the
old `assignedLotNums` workaround is gone.

Lives in `src/js/05b-pnl.js` as the pure function `computePnl(trades,
assetFilter) → { realised, ... }`. Dual-exported. The single source of truth
for the headline number on the Premium P&L Total tab and the cumulative-P&L
hero sparkline. ADR: `docs/adr/0003-pnl-cash-flow-lens.md`.

### Portfolio P&L (internal)
Engine field `lotEngine.portfolioPnl`. Aggregates:

- All net premiums (puts + calls, regardless of outcome)
- Minus `strike × size` debit on each ASSIGNED PUT
- Plus `strike × calledSize` credit on each CALLED CALL

**No longer the user-facing headline** — superseded by Realised P&L. Retained
in the engine output for now; treat as internal.

### Trade
A single recorded action: a PUT, a CALL, or a HOLDING (spot purchase). Has an
**outcome**: `OPEN` | `EXPIRED` | `ASSIGNED` | `CALLED` | `CLOSED`. Trades are
the only persisted state; lots are derived.

### Outcome
The terminal state of a Trade.
- `EXPIRED` — option expired worthless (premium kept)
- `ASSIGNED` — sold PUT was exercised; opens a new Lot
- `CALLED` — sold CALL was exercised; reduces (or closes) the Lot
- `CLOSED` — Hypersurface only, position bought back early; lot stays open

### Lot Engine
The pure function `lotEngine(assetTrades) → { lots, portfolioPnl,
portfolioPremiums, putOnlyPnl, tradeAccounting }` that walks one asset's
trades in date order and produces the per-asset accounting model. The single
source of truth for the wheel invariants. Lives in `src/js/04b-lot-engine.js`,
which also exports `lotNetCost(costBasis, lotPremiums, size)` — the only
place the Net Cost formula is written. Both are dual-exported (browser global
+ Node `module.exports`) so the engine can be exercised by `node --test`.

### Merge open lots
The pure function `mergeOpenLots(trades, asset) → trades'` in
`src/js/05a-merge-open-lots.js`. Combines all open lots for one asset into a
single lot using a size-weighted `costBasis` and summed `lotPremiums`, keeps
the earliest lot-opener and removes the others, and clears `lotNum`
references on the asset's CALL trades so they reattach to the surviving lot.
The merge modal is view + confirmation only; the wheel arithmetic is here.

### Outcomes registry
The `OUTCOMES` table in `src/js/01a-outcomes.js`: a single source of truth for
outcome **display data** (title, badge class) and **picker membership** (which
platforms allow which outcomes). Lot-lifecycle and P&L effects are *not* in
the registry — those live imperatively in the Lot Engine and chart code,
where the wheel-strategy invariants are written prose-style.

### Version
The git tag of the deployed build, displayed in the footer and the first-visit
wallet popup. Source of truth is `git describe --tags --always --dirty`,
substituted into a `{{VERSION}}` placeholder by `build.py`. A `-dirty` suffix
means the build contains uncommitted changes — useful for spotting
not-from-a-clean-tag deploys. Tags are created automatically by a GitHub Action
on every merge to `main` (see ADR 0001), so the footer always reflects current
shipped code without manual bookkeeping.

### Trade accounting snapshot
A per-trade record of the lot state **at the moment that trade was processed**
by the engine: `{ lotNum, lotSize, lotPremiums, lotCostBasis }`. Captured
because lot fields mutate over time (size shrinks on partial call-aways,
lotPremiums accumulates), so a post-hoc lookup would see the wrong values.
Consumed by `compute()` for row display.
