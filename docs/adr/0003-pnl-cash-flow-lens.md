# ADR 0001: P&L is computed under a cash-flow lens

- **Status:** Accepted
- **Date:** 2026-05-04
- **Supersedes:** none
- **Related:** Issue #12 (PRD), Issue #13 (Slice 1)

## Context

Until now, the headline "Net P&L" tile and the cumulative-P&L hero sparkline both
computed P&L as:

```
totalPremium − assignmentNotional + callAwayCredit
```

This formula is only correct for fully-rotated wheels. While a put-assigned lot
is open and not yet called away, the engine has subtracted the full assignment
notional (e.g. −$60k for a 1 BTC put assignment) without any offsetting credit.
A single open assigned lot can swing Net P&L by tens of thousands of dollars
even though the user's actual position is just *holding tokens at a known cost
basis*.

To paper over the worst symptom, the rendering layer added an `assignedLotNums`
filter that excluded HOLDING-originated lots from receiving call-away credit —
a workaround that produced asymmetric treatment of two economically identical
positions (a token bought spot vs. a token acquired by put assignment).

The number had stopped matching any defensible definition of P&L. It wasn't
realised (open lots distorted it) and it wasn't mark-to-market (spot price
didn't appear). The user lost trust in the headline figure.

## Decision

Adopt a **cash-flow lens** for the user-facing P&L numbers, splitting the
single tile into three:

- **Realised P&L** — settled-events only.
  `Σ(net premiums of settled options) + Σ over CALLED events of (strike − costBasis) × calledSize`.
  Open options and open lots contribute zero.
- **Unrealised P&L** — mark-to-market on currently open lots:
  `Σ over open lots of (spot − costBasis) × size`.
  Premiums collected against open lots are *not* counted here — they're already
  in Realised the moment the option settled.
- **Total P&L** — Realised + Unrealised.

The cumulative-P&L hero sparkline plots Realised only. (Unrealised is a
snapshot, not a flow — it can't be back-projected without historical spot data
we don't store.)

Slice 1 (this ADR) ships Realised + the sparkline switch. Unrealised and Total
land in subsequent slices.

The `assignedLotNums` workaround is removed: under the cash-flow lens,
HOLDING-originated and ASSIGNED-originated lots realise capital gain
symmetrically.

## Alternatives considered

### Net-cost lens (status quo formula, fixed)

`Σ premiums − Σ (assignmentNotional − callAwayNotional) over closed wheels`.
Net P&L only updates when a wheel fully rotates; open assigned lots show $0
P&L until they're called away or sold.

- ✓ Conceptually simple and single-number.
- ✗ Lumpy: P&L is invisible for the entire holding period, then jumps
  on call-away. Doesn't reflect realised premium income that already settled.
- ✗ Doesn't extend cleanly to HOLDING lots (no assignment notional to net
  against).
- ✗ Conflates capital deployment with P&L — the "−$60k assignment" is a
  position, not a loss.

### Hybrid (realised premium + open-lot unrealised, no separate Total)

A single tile showing premium realised + mark-to-market on open lots.

- ✓ Closer to brokerage account-equity feel.
- ✗ Mixes a flow (cumulative premium) with a snapshot (mark-to-market) into
  one number that moves for two reasons. Hard to defend or interpret.
- ✗ Tooltip explanation gets gnarly. We'd lose the ability to plot a clean
  cumulative time-series.

### Cash-flow lens (chosen)

Realised / Unrealised / Total as three separate tiles.

- ✓ Each number has a single, defensible definition.
- ✓ Realised is a clean monotone-ish flow: plottable, comparable month-on-month.
- ✓ Unrealised handles HOLDING and ASSIGNED lots symmetrically — the special
  case disappears.
- ✓ Total gives the "where do I stand" headline without sacrificing the
  decomposition.
- ✗ Three tiles is more screen real estate than one.
- ✗ User has to internalise the split. Mitigated by hover tooltips on every
  tile spelling out the formula and what's in/out.

The cash-flow lens is the only one of the three where the answer to *"what's
my P&L?"* doesn't depend on which lot is currently open or how it was opened.

## Consequences

- New module `src/js/05b-pnl.js` owns the calculation. Pure, dual-exported,
  consumed by `compute()` and the chart renderer.
- The `assignedLotNums` rendering-layer workaround is deleted; HOLDING and
  ASSIGNED lots are treated identically.
- The lot-engine field `portfolioPnl` is no longer the user-facing headline —
  it survives in the engine output for now but is internal-only.
- The hero sparkline empty state changes from
  *"No assignment losses — Net P&L equals Premium Income"* to
  *"No settled trades yet — Realised P&L starts at $0"*.
- Existing localStorage data (`hw_holdings`) is unchanged; the new lens is a
  pure recompute over `trades[]`.
- Historical Unrealised P&L is out of scope — we don't store spot-price
  history.
