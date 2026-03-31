# Rysk Wheel P&L Tracker

A single-file options trading tracker for the **Wheel strategy** on [Rysk Finance](https://app.rysk.finance) and [Hypersurface](https://app.hypersurface.io) — DeFi options platforms on HyperEVM (HyperLiquid L2).

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Trade logging** — log puts, calls, and holdings with full details (strike, size, premium, expiry, DTE)
- **Lot-based P&L tracking** — automatic lot creation on assignment, running lot premiums, net cost per token
- **Multi-platform** — supports both Rysk Finance and Hypersurface, including early close tracking (buy-to-close with close cost)
- **Close-at-profit alerts** — polls Hypersurface mark prices and alerts when open positions can be closed at 50%+ profit (configurable threshold)
- **Merge lots** — combine open lots when selling larger covered calls across previously split positions
- **Market scanner** — real-time spot prices, EMA/RSI technicals, support levels, and DVOL for BTC/ETH via CoinGecko and Deribit
- **8 themes** — Abyss (default), Gold, Ocean, Terminal, Charcoal, Crimson, Paper, Arctic, Matrix
- **Charts** — premium income over time and asset allocation breakdown
- **Import / Export** — JSON and CSV for backup and portability
- **Zero dependencies** — single HTML file, no build step, no npm. Chart.js loaded from CDN.

## Supported Assets

| Asset | Min Size (Rysk) | Notes |
|-------|----------------|-------|
| BTC   | 0.05           | Traded as UBTC on HyperEVM |
| ETH   | 0.5            | Traded as UETH on HyperEVM |
| HYPE  | 50             | wstHYPE / kHYPE map to HYPE |
| SOL   | 10             | Traded as uSOL on Rysk |

Hypersurface has no minimum contract size for any asset.

## Usage

### Local
Just open `rysk-pnl-tracker.html` in your browser. No server needed.

### Hosted
Deploy as a static site on Vercel or Render:

**Vercel** — import the repo, `vercel.json` handles routing automatically.

**Render** — create a Static Site, `render.yaml` is pre-configured.

## Data Storage

Trade data is stored in **localStorage** (`rysk_wheel_v4`). Data lives in your browser only — use the JSON export feature to back up regularly.

## Wheel Strategy Overview

The tracker is built around a premium-enhanced accumulation approach:

1. **Sell cash-secured puts** — collect premium while waiting to buy at your target price
2. **Get assigned** — acquire the asset at strike price minus premiums collected
3. **Sell covered calls** — collect premium on held assets
4. **Get called away / close early** — exit the position, start a new wheel cycle

Key metric: **net cost per token** = cost basis − (total lot premiums ÷ size)

## License

MIT
