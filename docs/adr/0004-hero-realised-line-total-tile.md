# ADR 0004: Hero is a Realised cumulative line plus a static Total P&L tile

- **Status:** Accepted
- **Date:** 2026-05-06
- **Supersedes:** none
- **Related:** ADR 0003 (cash-flow lens)

## Context

ADR 0003 established the cash-flow lens (Realised / Unrealised / Total) and
specified that the cumulative-P&L hero sparkline plots Realised only, because
Unrealised is a snapshot — it can't be back-projected without historical spot.

The implementation that landed has two issues the user surfaced on
2026-05-06:

1. The hero band currently renders **two** sparklines, both plotting Realised
   cumulative P&L over the same window. The second is a near-duplicate of the
   first, adds no information, and dilutes the salience of the headline.
2. Total P&L — which `CONTEXT.md` canonises as *"the single defensible 'where
   do I stand' figure"* — is not visible above the fold at all. It exists in
   `computePnl` but only surfaces in the Premium P&L tabs further down the
   page.

A future contributor will inevitably ask *"why isn't the hero a Total P&L
chart? CONTEXT.md says Total is the headline."* This ADR pins the answer down
so it doesn't need to be relitigated.

## Decision

The hero band is composed of exactly:

- **One** cumulative Realised P&L line, full-width left, with the big number
  showing current Realised and a 1M / 3M / ALL period toggle.
- A **Total P&L tile** placed beside the line (right side of the band). Two
  numbers stacked: `Unrealised` (smaller weight) and `Total` (peer weight to
  the hero's Realised number). No second chart.

The duplicate Realised sparkline is removed.

Missing-spot rendering on the tile:

- **Partial miss** (some open-lot assets have spot, others don't): tile shows
  the partial Total computed from the assets we have, with a muted sub-line
  `spot unavailable: <ASSET[, ASSET]>`. No asterisk on the number — an
  asterisked headline reads as "this number is suspect" and undermines trust.
- **Full miss** (no spot for any open-lot asset): `Unrealised` and `Total`
  both render as `—`, sub-line `spot unavailable`. Realised is unaffected.
- **No retry button, no "loading" state.** Spot fetches on boot; if it hasn't
  arrived, treat it as missing.

## Alternatives considered

### Total P&L as the hero time series

Plot cumulative Total P&L (Realised + Unrealised) as the line.

- ✓ Matches the `CONTEXT.md` framing of Total as the headline figure.
- ✗ Requires historical spot to draw honestly. We don't store it.
- ✗ Faking it (marking past lots against today's spot, or holding Unrealised
  flat until "now") produces a chart that looks authoritative but lies. Worse
  than not plotting it at all.
- ✗ Even if we backfilled spot from CoinGecko, Unrealised would dominate the
  series — a 30% spot move drowns out months of premium income, and the chart
  stops answering "is the wheel paying me?"

### Two charts side by side (Realised line + Unrealised line)

Keep two charts but make the second informative.

- ✓ Symmetric with the cash-flow lens decomposition.
- ✗ Same historical-spot problem for the Unrealised line.
- ✗ Two charts of equal weight competes for attention; the page already has
  Premium P&L tabs and an Expiring This Week table — the hero shouldn't be a
  dashboard, it should be a headline.

### Realised line + composition donut (per-asset)

Replace the duplicate sparkline with a donut showing Realised contribution by
asset.

- ✓ Decision-relevant (which asset is paying me).
- ✗ Asset-filter chips below the hero already let the user slice the line by
  asset on demand. A donut would be ambient eye-candy rather than answering a
  question that isn't already answerable.
- ✗ Spends top-of-page real estate on something that can live further down.

### Realised line + static Total tile (chosen)

- ✓ Headline answers two distinct questions: *"how did I get here?"* (the
  line) and *"where do I stand right now?"* (the tile).
- ✓ Honest — both halves are computable from data we actually have.
- ✓ Total tile preserves the `CONTEXT.md` headline framing without forcing a
  dishonest time series.
- ✗ Tile is static — no historical context for Total. Acceptable: the line
  already provides historical context for the flow component, and Unrealised
  history isn't recoverable anyway.

## Consequences

- The duplicate sparkline render path in `rCpnlChart` (`src/js/07-render-charts.js`,
  the `nToX` / `nToY` block) is removed.
- A new Total P&L tile component lives in the hero band, sourcing
  `unrealised`, `total`, and `missingSpotAssets` from `computePnl`
  (`src/js/05b-pnl.js`) — already exported, no engine changes required.
- The asset-filter chips continue to apply to both the line and the tile.
- If the team later decides to store historical spot (e.g. snapshot
  CoinGecko at boot into a rolling localStorage series), this ADR is the
  natural place to revisit — Total-as-a-line becomes possible and this
  decision can be superseded.
