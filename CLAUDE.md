# HyperWheel — Claude Code Project Memory

> **Read this file first. It is the source of truth — accurate as of 2026-05-01.**
> Do NOT scan the repo before making changes. Use the file map and function index
> below to jump directly to what you need.

A single-file HTML/JS/CSS wheel-strategy options tracker for **Rysk Finance**
(HyperEVM) and **Hypersurface**. The user trades BTC, ETH, HYPE, SOL.

- **Built artifact:** `hyperwheel.html` (local) and `public/index.html` (Vercel)
- **Edit only `src/`** — never edit the built files directly
- **Build:** `python3 build.py --check` (assembles + Node syntax-checks the script)

---

## Repo layout

```
hyperwheel.html           # built artifact — DO NOT EDIT
public/index.html         # built artifact for Vercel — DO NOT EDIT
build.py                  # assembler (concatenates src/ → hyperwheel.html)
api/sync.js               # Vercel serverless: KV-backed cloud sync of HOLDINGs
api/chain-sync.js         # Vercel serverless: CORS proxy to Rysk + Hypersurface
src/
  html/head.html          # <head> with /* CSS_PLACEHOLDER */ marker
  html/body.html          # <body>: header, main, drawer, footer, toast stack
  html/modals.html        # edit, merge, reset overlays
  css/styles.css          # all styles (single dark theme — see "Themes" note)
  js/01-state.js .. 18-chain-sync.js   # numbered modules, concatenated in order
```

JS modules are concatenated in lexicographic order, top-level functions become
globals, and 17-boot.js runs an IIFE last to bootstrap the app.

---

## File map (with key exports + line counts)

| File | Lines | Key exports / purpose |
|------|------:|-----------------------|
| `01-state.js` | 18 | `HW_WALLET_KEY`, `HW_HOLDINGS_KEY`, `HW_SYNCED_KEY`, `trades[]`, `sAsset/sType/sFilter/sPlatform/sSizeUnit/sPpnlTab/sCpnlPeriod`, `sHistOutcome/sHistFrom/sHistTo`, `livePrices{}`, `MIN_SIZE`, `ASSET_COLORS`, `mergeAsset` |
| `02-utils.js` | 29 | `today()`, `save()` (also kicks `scheduleCloudPush`), `fmt()` (max 2dp), `sk()` (K-abbrev), `loadWallet()`, `saveWallet()`, `toast(msg, kind?)` (`'ok'`/`'err'`/`'info'`) |
| `03-form-controls.js` | 211 | `setAsset/setType/setPlatform/setSizeUnit/setOut/setFilter/setPpnlTab`, `refreshLotPicker`, `autoFillFromLot`, `autoDTE`, history filters: `setHistOutcome/setHistFrom/setHistTo/clearHistFilters` |
| `04-trade-crud.js` | 39 | `addTrade()` (HOLDING-only — adds spot from drawer), `clearForm`, `deleteTrade`, `quickOutcome` (fires toasts) |
| `05-compute.js` | 170 | `compute(assetFilter)` → `{streams, lots, allRows, displayRows}`. Lot engine. **Key invariant:** assigned-PUT premium IS credited to the new lot's `lotPremiums` (line 61) — see Lot model below |
| `06-render-table.js` | 470 | `sortOpen/sortHist`, `renderExpiryTable` (today badge + mobile cards), `fetchExpiryPrices` (CoinGecko, calls full `render()` on success), `rTable` (holdings cards, open & history tables, history filter application), `rStats` (just delegates to `renderExpiryTable`), `exportHistoryCSV` (downloads filtered history as CSV) |
| `07-render-charts.js` | 640 | `setCpnlPeriod` (1M/3M/ALL), `rCpnlChart` (cumulative premium hero + npnl sparkline), `rCharts` (Premium P&L total/monthly tabs), `cOpts` (Chart.js options factory) |
| `08-render.js` | 7 | `render()` — orchestrator: `compute → rStats → rTable → rCharts` |
| `09-drawer-modal.js` | 15 | `openTradeDrawer`, `closeTradeDrawer`, `focusForm` |
| `10-reset-modal.js` | 4 | `showReset`, `closeReset`, `doReset` (wipes `trades`) |
| `11-wallet-popup.js` | 34 | `showWalletPopup`, `hideWalletPopup`, `submitWalletPopup` (first-visit wallet entry) |
| `12-cloud-sync.js` | 66 | `_setCloudStatus`, `cloudPush` (debounced via `scheduleCloudPush`), `cloudPull` — pushes/pulls **only HOLDING trades** to `/api/sync` keyed by wallet. Toasts on error and on pull-with-data |
| `13-edit-modal.js` | 103 | `openEditModal(id)`, `closeEditModal`, `saveEdit` — fields prefixed `ef-` (NOT `e-` despite older docs) |
| `14-merge-modal.js` | 106 | `openMergeModal(asset)`, `closeMergeModal`, `confirmMerge` — combines open lots with weighted-average cost basis |
| `15-event-listeners.js` | 6 | global keydown (Esc closes modals/drawer) |
| `16-clock.js` | 20 | UTC clock IIFE for header |
| `17-boot.js` | 33 | init IIFE: load trades, wallet popup OR `render() + fetchExpiryPrices() + cloudPull → autoLoadChain` |
| `18-chain-sync.js` | 459 | Rysk + Hypersurface chain sync: `autoLoadChain`, `syncRysk`, `syncHypersurface`, `applyCloseTrade`, `autoDetectOutcomes`, `migrateCloseTrades`. Routes through `/api/chain-sync` proxy. `hasProxy()` returns false on `file://` |

**Line numbers above are approximate** — they shift as the code evolves. Use them
as starting anchors, not exact addresses. Re-grep if a function moved.

---

## Non-negotiable rules

1. **Always run `python3 build.py --check` after every src/ edit.** Never present
   a change with a failing build.
2. **No hardcoded colours in component styles.** Use CSS variables from `:root`.
3. **Edit only `src/`.** The single-file output is generated.
4. **Don't wrap the script in `DOMContentLoaded`.** Inline `onclick=` handlers
   need globals, and `17-boot.js` runs at parse time.
5. **Don't use `maximumFractionDigits: 0` in `fmt()`** — it would round strikes.

---

## Trade object shape (current)

```js
{
  id: 1738291203848,        // Date.now() unique key
  asset: 'BTC',             // BTC | ETH | HYPE | SOL
  type: 'PUT',              // PUT | CALL | HOLDING
  date: 'YYYY-MM-DD',       // open date
  expiry: 'YYYY-MM-DD',     // empty for HOLDING
  dte: 21,                  // null for HOLDING
  strike: 63000,            // strike, or cost basis if HOLDING
  size: 0.05,               // contract / token size
  premium: 150,             // premium collected (0 for HOLDING)
  outcome: 'OPEN',          // OPEN | EXPIRED | ASSIGNED | CALLED | CLOSED
  closeCost: 0,             // for CLOSED outcome (Hypersurface buy-to-close)
  platform: 'RYSK',         // RYSK | HSFC | SPOT
  lotNum: 2,                // optional explicit lot for CALLs (else attaches to openLot)
  txHash: '0x…',            // present iff imported from chain-sync
  notes: '',                // free-form (currently no UI to view/edit beyond edit modal)
}
```

---

## Lot model (`compute()` in `05-compute.js`)

- **HOLDING** → opens a new lot at `costBasis = strike`
- **PUT** unassigned → portfolio P&L only, no lot
- **PUT ASSIGNED** → opens new lot, debits portfolio P&L by `strike*size`,
  **and credits the put's `netPrem` to the new lot's `lotPremiums`** (so the
  put's premium reduces net cost just like subsequent calls do)
- **CALL** → attaches to lot by explicit `lotNum`, else to `openLot`. `netPrem`
  accrues to `lot.lotPremiums`. **CALLED** outcome credits `strike * calledSize`
  to portfolio P&L and reduces (or closes) the lot
- **CLOSED** (Hypersurface only) → CALL stays open, premium reduced by `closeCost`
- `netCost = costBasis - (lotPremiums / size)` per lot

---

## localStorage keys

| Key | Contents |
|-----|----------|
| `hw_wallet` | Connected wallet address (lowercase, `0x...`) |
| `hw_holdings` | Trade array (JSON) |
| `hw_synced_v1` | Set of chain-imported trade IDs (so we don't re-import) |
| `hw_cloud_ts` | Last successful cloud-sync timestamp |

There is **no theme key** — the app currently ships a single dark theme.
There is **no AI-key entry, no scanner state, no preferences object**.

---

## Cloud sync

- `/api/sync` (Vercel serverless, Upstash KV) — stores `{holdings, savedAt}` keyed
  by `hw:<wallet>`. **Only `type === 'HOLDING'` trades are synced.** Options
  history is local-only.
- `cloudPush()` is debounced 300ms via `scheduleCloudPush()`, called from `save()`
- `cloudPull()` pulls on boot if `remoteTs > localTs`; sets `_suppressPush`
  while replacing local HOLDINGs to avoid loops
- Status indicator: `#footer-cloud` (`push`/`pull`/`ok`/`err`)
- Toasts fire on push error, pull error, and pull-with-data

---

## Chain sync (Rysk + Hypersurface)

- Routes through `/api/chain-sync` because direct calls hit CORS
- `hasProxy()` returns false when served over `file://` — chain sync is silently
  skipped
- Rysk: REST endpoints `?source=rysk&type=history|positions&address=...`
- Hypersurface: GraphQL POST to a Goldsky URL passed via `?source=hypersurface&url=...`
- Imported trades carry `txHash` and are tracked in `hw_synced_v1` to avoid dupes
- `autoDetectOutcomes` matches close trades to opens; `migrateCloseTrades` is a
  one-shot fix-up

---

## Asset config

| Asset | Min size (Rysk) | CSS var | Hex | Notes |
|-------|-----:|---------|---------|------|
| BTC | 0.05 | `--btc` | `#f7931a` | UBTC on chain |
| ETH | 0.5 | `--eth` | `#627eea` | UETH on chain |
| HYPE | 50 | `--hype` | `#00e5a0` | wstHYPE / kHYPE / WHYPE all map to HYPE |
| SOL | 10 | `--sol` | `#9945ff` | uSOL on Rysk |

Hypersurface has no minimum contract size.

```js
const MIN_SIZE = { BTC: 0.05, ETH: 0.5, HYPE: 50, SOL: 10 };
```

Rysk size increments are exact: HYPE 50, ETH 0.5, BTC 0.05 (for both calls and puts).

---

## Themes — current state

There is **only one theme** (the dark default) defined entirely in `:root` of
`src/css/styles.css`. There is no theme picker, no `[data-theme=...]` selectors,
no `setTheme()` function. Older docs claimed an 8-theme system; this was never
shipped (or was removed). Don't add hardcoded colours anyway — use the existing
CSS vars so adding themes later remains cheap.

---

## Removed / never-existed features (don't re-propose)

- Wallet sync direct from `file://` — CORS blocks v12.rysk.finance. Use the
  serverless proxy instead (already in place via `/api/chain-sync`)
- Theme picker — removed/never shipped
- Market scanner (CoinGecko OHLC, EMA, RSI, support detection) — not present
- AI analysis panel (Anthropic API key in localStorage) — not present
- Import/Export JSON/CSV UI — not present
- Notes view UI beyond the edit modal — `notes` field exists on trades but
  no separate viewer

---

## Recently added (May 2026)

- **Holdings cards** (`06-render-table.js`): live spot, unrealized P&L vs net
  cost, "next call ≥ $X to stay above net cost" hint
- **Expiring This Week**: today badge in section header, quick-action buttons
  on every row (not only same-day), mobile card layout (<600px)
- **History filters**: outcome pills + From/To date pickers above Position
  History table
- **Toasts** (`02-utils.js`): bottom-center stack, fired from add/delete/quick-
  outcome/edit/cloud events. Use `toast(msg, 'ok'|'err'|'info')`
- **Inline SVG favicon** (`head.html`)
- **Compute fix**: assigned-PUT premium now credits the new lot's `lotPremiums`
  (was previously only counted in portfolio P&L, leaving net cost too high)

---

## Common gotchas

- **Object literal in arrow function**: `r => { K: v }` parses as a block.
  Use `r => ({ K: v })`.
- **Modal visibility**: use `classList.add/remove('open')` on the overlay —
  never toggle `display`. CSS handles `opacity` + `pointer-events`.
- **Edit modal field IDs**: `ef-date`, `ef-strike`, `ef-size`, `ef-premium`,
  `ef-outcome`, `ef-notes`, `ef-expiry`, `ef-dte`. Older docs said `e-…` —
  ignore that.
- **`fmt()` precision**: keeps up to 2 decimal places. Do not change to 0.
- **Don't add `npm`/bundlers.** Single-file output is the constraint.

---

## Wheel strategy context

User's approach is **premium-enhanced accumulation**, not pure yield. Happy to
be assigned and hold long-term. Key metric: net cost per token.

Strike-selection targets:
- BTC: 10–15% OTM puts / 8–12% OTM calls
- ETH: 15–20% OTM puts / 12–18% OTM calls
- HYPE/SOL: 15–22% OTM puts / 12–18% OTM calls

DTE targets: BTC 21–28d, ETH/HYPE/SOL 14–21d.

---

## Live options-chain fetch (reference; not currently wired in)

`app.rysk.finance` embeds the inventory in its RSC payload. Fetch with header
`RSC: 1`, walk braces from `"serverInventory" → "<ASSET>":{"combinations":...}`.
Each entry: `expiry`, `timeToExpiryDays`, `strike`, `isPut`, `apy`, `index`
(spot), `bidIv`/`askIv`, `delta`, `products`. Useful if a future feature wants
suggested strikes inside the form.
