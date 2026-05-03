# HyperWheel

A single-file P&L tracker for the **Wheel strategy** on
[Rysk Finance](https://app.rysk.finance) and
[Hypersurface](https://app.hypersurface.io) — DeFi options platforms on
HyperEVM (HyperLiquid L2).

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Trade logging** — puts, calls, and spot holdings with strike, size, premium,
  expiry, DTE
- **Lot-based P&L** — automatic lot creation on assignment; assigned-put premium
  credits the new lot's net cost; running call-premium accumulation per lot;
  net cost per token
- **Holdings cards** — live spot price, unrealized P&L per lot, and a hint for
  the minimum next-call strike to stay above net cost
- **Premium income & Net P&L charts** — cumulative hero with 1M / 3M / ALL
  ranges plus a Net P&L sparkline
- **Premium P&L stats** — total + monthly tabs (premium collected, net P&L,
  notional, portfolio APR, return rate)
- **Expiring This Week** — table view with live OTM/ITM status, today-count
  badge, and quick Exp/Asgn/Called buttons on every row. Mobile card layout.
- **History filters** — outcome pills (Expired / Assigned / Called / Closed)
  and From/To date range
- **Multi-platform** — Rysk and Hypersurface, including buy-to-close (CLOSED
  outcome with close cost) on Hypersurface
- **Merge lots** — combine open lots when scaling up covered calls
- **Cloud sync** — wallet-keyed sync of spot holdings via Vercel KV
- **Chain sync** — auto-import trade history from Rysk and Hypersurface via
  serverless proxy
- **Toasts** — non-blocking confirmations for adds, edits, deletes, and sync
  events
- **Zero runtime dependencies** — single HTML file, no bundler. Chart.js loaded
  from CDN.

## Supported assets

| Asset | Min size (Rysk) | Notes |
|-------|----------------:|-------|
| BTC   | 0.05 | UBTC on HyperEVM |
| ETH   | 0.5  | UETH on HyperEVM |
| HYPE  | 50   | wstHYPE / kHYPE / WHYPE all map to HYPE |
| SOL   | 10   | uSOL on Rysk |

Hypersurface has no minimum contract size.

## Usage

### Local
Open `hyperwheel.html` in any browser. Cloud sync and chain sync require the
serverless API endpoints, which are only active on a hosted deployment.

### Hosted
Deploy as a static site on Vercel (the included `api/` functions are
zero-config Vercel serverless handlers). Set `KV_REST_API_URL` and
`KV_REST_API_TOKEN` env vars to enable cloud sync.

## Development

This repo uses a small build step (no npm). Edit modular sources under `src/`,
then rebuild:

```bash
python3 build.py --check
```

That assembles `hyperwheel.html` and `public/index.html` and runs a Node
syntax check on the assembled script. **Never edit the built files directly.**

Pure modules (Lot Engine, `mergeOpenLots`, `lotNetCost`) have a Node-only
test harness — no npm, no bundler:

```bash
node --test test/
```

See [`CLAUDE.md`](./CLAUDE.md) for the full source map, file-by-file function
index, lot model, and architectural notes. See [`CONTEXT.md`](./CONTEXT.md)
for the wheel-strategy domain glossary.

## Data storage

Trade data lives in browser localStorage:

| Key | Contents |
|-----|----------|
| `hw_wallet` | Connected wallet address |
| `hw_holdings` | Trade array (JSON) |
| `hw_synced_v1` | Set of chain-imported trade IDs |
| `hw_cloud_ts` | Last cloud-sync timestamp |

Use cloud sync (or copy `hw_holdings` from devtools) to back up.

## Wheel strategy in one paragraph

Sell cash-secured puts to collect premium while waiting to buy at a target
price. If assigned, you acquire the asset at strike *minus* premiums collected.
Sell covered calls on the held asset to keep collecting premium. If called away,
exit at the call strike and start a new wheel cycle. The tracker's key metric
is **net cost per token = cost basis − (lot premiums ÷ size)**, which falls
every cycle the position survives.

## Disclaimer

This is a personal-use tracker, not financial advice. Options trading carries
substantial risk — you can lose more than your premium on naked or
inadequately-collateralised positions. Numbers shown are computed from data
you (or the chain-sync importer) entered; bugs in the lot engine could
mis-state cost basis, P&L, or net cost. Verify against your platform's own
records before making decisions. Provided **as is**, with no warranty — see
[`LICENSE`](./LICENSE).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). TL;DR: edit `src/`, run
`python3 build.py --check`, open a PR.

## License

MIT — see [`LICENSE`](./LICENSE).
