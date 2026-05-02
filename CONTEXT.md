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

### Portfolio P&L
The asset-level realised P&L, distinct from per-lot accounting. Aggregates:

- All net premiums (puts + calls, regardless of outcome)
- Minus `strike × size` debit on each ASSIGNED PUT
- Plus `strike × calledSize` credit on each CALLED CALL

Independent of unrealised P&L on currently-held lots (which is computed from
live spot prices, not from the engine).

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
The pure function `lotEngine(assetTrades) → { lots, portfolioPnl, …,
tradeAccounting }` that walks one asset's trades in date order and produces
the per-asset accounting model. The single source of truth for the wheel
invariants. Lives in `src/js/04b-lot-engine.js`.

### Outcomes registry
The `OUTCOMES` table in `src/js/01a-outcomes.js`: a single source of truth for
outcome **display data** (title, badge class) and **picker membership** (which
platforms allow which outcomes). Lot-lifecycle and P&L effects are *not* in
the registry — those live imperatively in the Lot Engine and chart code,
where the wheel-strategy invariants are written prose-style.

### Trade accounting snapshot
A per-trade record of the lot state **at the moment that trade was processed**
by the engine: `{ lotNum, lotSize, lotPremiums, lotCostBasis }`. Captured
because lot fields mutate over time (size shrinks on partial call-aways,
lotPremiums accumulates), so a post-hoc lookup would see the wrong values.
Consumed by `compute()` for row display.
