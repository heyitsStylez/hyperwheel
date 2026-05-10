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
assetFilter, livePrices) → { realised, unrealised, total, missingSpotAssets,
realisedSeries }`. Dual-exported. The single source of truth for the headline
number on the Premium P&L Total tab and the cumulative-P&L hero sparkline.
ADR: `docs/adr/0003-pnl-cash-flow-lens.md`.

### Unrealised P&L
Mark-to-market on currently open lots:

```
unrealised = Σ over open lots of (spot − costBasis) × size
```

Marks against **raw `costBasis`, never `netCost`** — premiums collected against
open lots are already counted in Realised. HOLDING-originated and
ASSIGNED-originated lots are treated identically. Updates whenever spot
refreshes. Spot comes from `livePrices` (the global the CoinGecko fetch
populates); when an asset's spot is missing, that asset's open lots are
**excluded** from the sum and the asset is reported in `missingSpotAssets` so
the UI can show a "spot unavailable for {asset}" sub-line. Never falls back to
$0 or stale cached spot.

### Total P&L
`Total = Realised + Unrealised`. The single defensible "where do I stand"
figure — what the book is worth if every open lot were sold at current spot
right now. Same `missingSpotAssets` semantics as Unrealised: when all
open-lot assets are missing spot the tile shows a dash; partial coverage
shows the partial total with the missing assets called out.

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
wallet popup. Source of truth is `git describe --tags --always`, substituted
into a `{{VERSION}}` placeholder by `build.py`. The `--dirty` flag was
deliberately dropped: Vercel's build environment auto-runs `npm install` and
rewrites tracked files mid-build, so every deploy looked `-dirty` regardless
of source state — the signal was noise, not a "not-from-a-clean-tag" tell.
Tags are created automatically by a GitHub Action on every merge to `main`
(see ADR 0001), and `vercel.json` runs `git fetch --tags` before the build so
the deploy can resolve them. The footer always reflects current shipped code
without manual bookkeeping.

### Hero
The top-of-page chart band. Composition is fixed:

- **One** Realised P&L cumulative line (the time series), with the big number =
  current Realised total and a 1M / 3M / ALL period toggle.
- A **Total P&L tile** sitting beside the line (not a second chart): two
  stacked numbers — `Unrealised` and `Total` (= Realised + Unrealised). When
  spot is missing for any open-lot asset, the affected number renders with a
  muted sub-line `spot unavailable: <ASSET>` rather than an asterisk; full
  miss renders as `—`. Realised is unaffected by missing spot.

The hero deliberately does **not** plot a Total P&L time series. Total
requires historical spot to plot honestly; we don't store it. Realised is the
only series we can draw without backfilling. Total lives as a "right now"
snapshot beside the chart, not behind it. ADR: `docs/adr/0004-hero-realised-line-total-tile.md`.

### DTE vs Term
Two distinct concepts that share a number but not a meaning:

- **DTE** — *days to expiry*, a **live countdown** computed as
  `round((expiry − today) / day)`. Used on views of active contracts:
  Expiring This Week and the Open Positions table.
- **Term** — the **original DTE at the moment the trade was opened**, frozen
  on the Trade as `t.dte`. Used on Position History (settled trades), where a
  countdown is meaningless.

Column headers must reflect this: live tables read **DTE**, settled tables
read **Term**. Never label a frozen original-DTE column "DTE" — the
ambiguity historically led to three identically-labelled columns showing two
different numbers.

### Premium Statistics
A gross-premium-income view over a set of Trade rows. Distinct from Realised
P&L (which is a cash-flow lens): Premium Statistics treats premium collected as
the primary signal and derives:

- **Total premium** — sum of net premiums across all trades in the set
- **Total notional** — Σ strike × size (capital at risk)
- **Portfolio APR** — notional-weighted average APR of settled options:
  `(netPrem / collateral) / DTE × 365`, weighted by notional
- **Return rate** — share of settled options that expired OTM (premium kept)
- **OTM / ITM counts** — settled outcome breakdown

Lives in `src/js/05d-calc-stats.js` as the pure function
`calcPremiumStats(rows) → { totalPrem, totalNotional, portfolioAPR, returnRate,
otmCount, itmCount, openCount, settled, totalCount }`. Dual-exported. Consumed
by `rCharts` for the Premium P&L Total and Monthly tabs.

Intentionally does **not** include Realised P&L or Unrealised P&L — those live
in `computePnl`. The two functions answer different questions: `computePnl`
answers *"what did this position earn under cash-flow accounting?"*;
`calcPremiumStats` answers *"how is the premium-income engine performing?"*

### Trade accounting snapshot
A per-trade record of the lot state **at the moment that trade was processed**
by the engine: `{ lotNum, lotSize, lotPremiums, lotCostBasis }`. Captured
because lot fields mutate over time (size shrinks on partial call-aways,
lotPremiums accumulates), so a post-hoc lookup would see the wrong values.
Consumed by `compute()` for row display.
