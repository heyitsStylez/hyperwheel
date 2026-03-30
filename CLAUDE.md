# Rysk Wheel P&L Tracker — Claude Code Project Memory

## Project overview
A single-file HTML/JS/CSS options trading tracker for the **Wheel strategy** on
[Rysk Finance](https://v12.rysk.finance) — a DeFi options platform on HyperEVM
(HyperLiquid L2, chainId 999). The user trades BTC, ETH, HYPE, and SOL.

## User wallet
**EVM wallet address:** `0xe94a312B9e8B4B5117aEB485dd749c3547aC06C2`
Use this address when querying on-chain balances, positions, or any blockchain data.

**Output file:** `rysk-pnl-tracker.html` (~143 KB, single file, no build step)

---

## Non-negotiable development rules

### 1. Always syntax-check before finishing
After **every** edit to the HTML file, extract the JS and run Node:

```bash
python3 -c "
with open('rysk-pnl-tracker.html') as f:
    c = f.read()
s = c.find('<script>\nconst KEY')
e = c.rfind('</script>')
open('/tmp/test.js','w').write(c[s+8:e])
"
node --check /tmp/test.js
```

Iterate until the exit code is 0. Never present the file with a failing check.

### 2. No hardcoded colours — ever
All colours must use CSS variables. No hex values or `rgb()` literals in
component styles. The 8-theme system defines everything via `--var` tokens.

### 3. Single-file constraint
Everything — HTML, CSS, JS — lives in `rysk-pnl-tracker.html`. No external
files, no build tools, no npm. Chart.js is loaded from cdnjs.

---

## Asset configuration

| Asset | Min size | Colour var | Hex      | Notes                        |
|-------|----------|------------|----------|------------------------------|
| BTC   | 0.05     | `--btc`    | #f7931a  |                              |
| ETH   | 0.5      | `--eth`    | #627eea  |                              |
| HYPE  | 50       | `--hype`   | #00e5a0  | wstHYPE/kHYPE map to HYPE   |
| SOL   | 10       | `--sol`    | #9945ff  | Traded as uSOL on Rysk       |

```js
const MIN_SIZE = { BTC: 0.05, ETH: 0.5, HYPE: 50, SOL: 10 };
```

---

## Platform context (Rysk Finance)

- **No early exit / no rolling** — positions are fully locked until expiry
- **No assignment on puts** in the traditional sense — settled in USDC at expiry
- Options are European-style, cash-settled
- HyperEVM token names: UBTC, UETH, kHYPE, wstHYPE, uSOL
- CORS blocks all direct API calls from `file://` — do not attempt wallet sync
- **Trade size increments (must be exact multiples — no arbitrary sizes, applies to both calls AND puts):**
  - HYPE / kHYPE / WHYPE: **50-token increments** (50, 100, 150, 200, …) — minimum 50
  - ETH / UETH: **0.5-token increments** (0.5, 1.0, 1.5, …) — minimum 0.5
  - BTC / UBTC: **0.05-token increments** (0.05, 0.10, 0.15, …) — minimum 0.05

### Live options chain API (no SDK needed)

The `app.rysk.finance` Next.js server embeds the full options inventory in its
RSC payload on every page load. Fetch it directly — no auth, no WebSocket:

```python
import requests, json

def get_hype_options():
    url = "https://app.rysk.finance/earn/999/WHYPE/USDT0/USDT0/put/"
    r = requests.get(url, headers={"RSC": "1"})
    text = r.text

    # Locate serverInventory and HYPE block
    inv_idx = text.find('"serverInventory"')
    hype_start = text.find('"HYPE":{"combinations"', inv_idx)
    comb_start = text.find('{"combinations":', hype_start) + len('{"combinations":')

    # Walk braces to extract combinations JSON
    depth, in_str, i = 0, False, comb_start
    while i < len(text):
        c = text[i]
        if c == '"' and text[i-1] != '\\': in_str = not in_str
        if not in_str:
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    comb_json = text[comb_start:i+1]
                    break
        i += 1

    combinations = json.loads(comb_json)
    spot = list(combinations.values())[0]['index']

    options = []
    for o in combinations.values():
        otm = (spot - o['strike'])/spot if o['isPut'] else (o['strike'] - spot)/spot
        options.append({
            'expiry': o['expiry'],
            'dte': round(o['timeToExpiryDays'], 1),
            'strike': o['strike'],
            'isPut': o['isPut'],
            'otmPct': round(otm * 100, 1),
            'apy': round(o['apy'], 2),
            'spot': spot,
        })
    return sorted(options, key=lambda x: (x['expiry'], x['isPut'], x['strike']))
```

The response `serverInventory.HYPE.combinations` is keyed as
`"{strike}-{expiration_timestamp}"` and each entry contains:
- `expiry` — e.g. `"27MAR26"`, `"3APR26"`, `"24APR26"`
- `timeToExpiryDays` — float DTE
- `strike` — strike price (same scale as HYPE spot)
- `isPut` — boolean
- `apy` — annualised yield as a decimal × 100 (e.g. `66.42` = 66.42% APY)
- `index` — current HYPE spot price
- `bidIv` / `askIv` — implied volatility
- `delta` — option delta
- `products` — array of `{asset, strikeAsset, collateralAsset}` addresses

**Available expiries (as of Mar 2026):** 27MAR26 (~8d), 3APR26 (~15d), 24APR26 (~36d)

**WHYPE = HYPE** in the inventory. kHYPE covered calls use the same HYPE
strike prices as reference. The SDK repos (`ryskV12-cli`, `ryskV12_py`,
`ryskV12_ts`) are market-maker–only tools and cannot query the options chain.

---

## Wheel strategy context

The user's approach is **premium-enhanced accumulation**, not pure yield:
- Happy to be assigned / hold BTC, ETH, HYPE, SOL long-term
- Key metric: **net cost per token** (cost basis minus premiums collected ÷ size)
- Idle USDC earns yield while backing puts

**Strike selection targets:**
- BTC: 10–15% OTM puts / 8–12% OTM calls
- ETH: 15–20% OTM puts / 12–18% OTM calls
- HYPE/SOL: 15–22% OTM puts / 12–18% OTM calls

**DTE targets:**
- BTC: 21–28 days
- ETH/HYPE/SOL: 14–21 days

---

## Codebase architecture

### JS structure (inside one `<script>` block)
```
const KEY / state vars / MIN_SIZE / ASSET_COLORS
→ Theme system (setTheme, theme picker)
→ Form controls (setAsset, setFilter, setType, addTrade, clearForm)
→ Persistence (save, load)
→ Compute engine (compute) — lot-aware, multi-wheel per asset
→ Render pipeline (render → rStats, rTable, rCharts)
→ Import/Export (exportJSON, exportCSV, readImportFile)
→ Reset modal
→ Market scanner (runScan, buildAssetData, findSupports, calcEMA, calcRSI, getRecommendation, renderScan)
→ AI analysis (toggleAIPanel, runAIAnalysis, formatAIResponse)
→ Edit trade modal (openEditModal, closeEditModal, saveEdit, onEditTypeChange)
→ Utility functions (fmt, sk, fmtK, fmtDate)
```

### Lot model (compute function)
- **PUT trades** — portfolio level, no lot until assigned
- **HOLDING / ASSIGNED** → opens a new lot with `costBasis` and `size`
- **CALL trades** → attach to the open lot for that asset; accumulate `lotPremiums`
- **CALLED** → closes the lot
- `netCost = costBasis - (lotPremiums / size)` per lot

### Trade object shape
```js
{
  id: Date.now(),       // unique key
  asset: 'BTC',         // BTC | ETH | HYPE | SOL
  type: 'PUT',          // PUT | CALL | HOLDING
  date: 'YYYY-MM-DD',   // open date
  expiry: 'YYYY-MM-DD', // expiry (empty for HOLDING)
  dte: 21,              // days to expiry (null for HOLDING)
  strike: 63000,        // strike price or cost basis for HOLDING
  size: 0.05,           // contract size
  premium: 150,         // USD premium collected (0 for HOLDING)
  outcome: 'OPEN',      // OPEN | EXPIRED | ASSIGNED | CALLED
  notes: '',
}
```

---

## localStorage keys
| Key              | Contents                         |
|------------------|----------------------------------|
| `rysk_wheel_v4`  | Trade data (JSON array)          |
| `rysk_theme_v1`  | Selected theme name              |
| `rysk_ai_key_v1` | Anthropic API key for AI analysis|

---

## Theme system (8 themes)
**Dark:** `abyss` (default), `gold`, `ocean`, `terminal`, `charcoal`, `crimson`  
**Light:** `paper`, `arctic`

Every theme defines the full set of CSS variables on `[data-theme="name"]`.
Required asset vars per theme: `--btc`, `--btcd`, `--btcb`, `--eth`, `--ethd`,
`--ethb`, `--hype`, `--hyped`, `--hypeb`, `--sol`, `--sold`, `--solb`.

---

## HTML element ID conventions
- Asset toggle buttons (form): `ab-BTC`, `ab-ETH`, `ab-HYPE`, `ab-SOL`
- Filter tabs (trade log): `fb-ALL`, `fb-BTC`, `fb-ETH`, `fb-HYPE`, `fb-SOL`
- Edit modal fields: `e-asset`, `e-type`, `e-outcome`, `e-date`, `e-expiry`, `e-dte`, `e-strike`, `e-size`, `e-premium`, `e-notes`, `e-err`
- Scanner: `scan-body`, `scan-refresh-btn`
- AI panel: `ai-panel`, `ai-run-btn`

---

## External APIs used (scanner)
- **CoinGecko** — `/simple/price` (current price + 24h change) and `/ohlc?days=90` (90-day OHLC for EMA/RSI/support detection) for all 4 assets
  - BTC id: `bitcoin`, ETH: `ethereum`, HYPE: `hyperliquid`, SOL: `solana`
- **Deribit DVOL** — BTC and ETH only (`BTC_DVOL`, `ETH_DVOL`); HYPE/SOL show `—`

---

## Known gotchas / history

- **CORS** — Rysk API wallet sync was built and removed; `file://` origin blocks all v12.rysk.finance responses. Do not re-propose.
- **Orphan `});`** — a previous DOMContentLoaded wrapper was removed but left a stray `});` at end of script. Node's exit code catches this.
- **Object literal in arrow function** — `r => { KEY: val }` is parsed as a block, not an object. Always use `r => ({ KEY: val })`.
- **Template literals with bare labels** — multiline backtick strings containing `ASSET:` on its own line cause `Unexpected token ':'`. Build prompt strings with concatenation instead.
- **Modal visibility** — overlays use `opacity:0; pointer-events:none` as default + `.open` class to show. Never toggle `display` directly; use `classList.add/remove('open')` with `requestAnimationFrame`.
- **Duplicate modals** — an old incomplete edit modal existed alongside the new one. Always grep for duplicate `id="edit-overlay"` if modal behaviour is wrong.
- **`fmt()` precision** — uses `maximumFractionDigits:2` to preserve decimals like `32.5`. Do not revert to `0`.

---

## Utility functions reference
```js
fmt(n)   // toLocaleString with up to 2 decimal places  → "32.5", "1,625"
sk(v)    // abbreviate thousands                        → "1.5K", "85K"
fmtK(v)  // similar abbreviation used in scanner
fmtDate(s) // format date string for display
```

---

## What NOT to do
- Do not add `npm`, `webpack`, `vite`, or any build tooling
- Do not split into multiple files
- Do not use hardcoded hex colours in component styles
- Do not re-add Rysk API wallet sync (CORS, was deliberately removed)
- Do not wrap the entire script in a `DOMContentLoaded` callback (breaks `onclick=` handlers)
- Do not use `maximumFractionDigits: 0` in `fmt()` (rounds strike prices)
