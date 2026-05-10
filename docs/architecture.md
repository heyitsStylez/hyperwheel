# HyperWheel — Architecture

> **Living document.** Update when module boundaries or external interfaces change.
> Maintained by agent during PR review or grill-with-docs sessions — no automation required.

---

## System Context

Who the app talks to and why.

```mermaid
flowchart TD
    User([User / Browser])

    subgraph Vercel
        App["hyperwheel.html\n(single-file SPA)"]
        SyncAPI["/api/sync\n(Vercel serverless)"]
        ChainAPI["/api/chain-sync\n(Vercel serverless\nCORS proxy)"]
    end

    subgraph External
        KV[("Upstash KV\nhw:<wallet> → HOLDINGs")]
        CoinGecko["CoinGecko REST\n(spot prices)"]
        Rysk["Rysk Finance REST\n(options history\n+ positions)"]
        Hypersurface["Hypersurface GraphQL\n(Goldsky endpoint)"]
    end

    User -->|loads| App
    App -->|push / pull HOLDINGs\nkeyed by wallet| SyncAPI
    SyncAPI <-->|read / write| KV
    App -->|spot prices\nBTC / ETH / HYPE / SOL| CoinGecko
    App -->|chain sync\n?source=rysk or hypersurface| ChainAPI
    ChainAPI -->|history + positions| Rysk
    ChainAPI -->|trades GraphQL| Hypersurface
```

**Notes:**
- Chain sync is skipped when `hasProxy()` returns false (i.e. served over `file://`).
- Cloud sync pushes **only `type === 'HOLDING'` trades**; options history is local-only.
- CoinGecko is called directly from the browser (no proxy needed — no auth, no CORS issue).

---

## Core Data Flow

How a trade becomes a number on screen.

```mermaid
flowchart TD
    LS[("localStorage\nhw_holdings")]
    Trades["trades[]\nglobal array"]

    subgraph Engine ["Lot Engine — 04b-lot-engine.js"]
        LE["lotEngine(assetTrades)\n→ { lots, portfolioPnl,\n   portfolioPremiums,\n   putOnlyPnl,\n   tradeAccounting }"]
    end

    subgraph Compute ["Compute — 05-compute.js"]
        CO["compute(assetFilter)\n→ { streams, lots,\n   allRows, displayRows }"]
    end

    subgraph PnL ["P&L — 05b-pnl.js"]
        CP["computePnl(trades, assetFilter, livePrices)\n→ { realised, unrealised, total,\n   missingSpotAssets,\n   realisedSeries, realisedByMonth }"]
    end

    subgraph Stats ["Stats — 05d-calc-stats.js"]
        CS["calcPremiumStats(rows)\n→ { totalPrem, totalNotional,\n   portfolioAPR, returnRate,\n   otmCount, itmCount }"]
    end

    subgraph Render
        R8["render() — 08-render.js\norchestrator"]
        RT["rTable() — 06-render-table.js\nHoldings cards\nOpen positions\nPosition History\nExpiring This Week"]
        RC["rCharts() — 07-render-charts.js\nHero: Realised P&L line\nTotal P&L tile\nPremium tabs"]
        ROC["rOutcomeChart() — 06a-render-outcome-chart.js\nOutcome treemap"]
    end

    LS -->|load on boot| Trades
    Trades -->|per-asset slice| LE
    LE -->|lots + accounting| CO
    CO -->|displayRows| RT
    CO -->|streams| RC
    Trades -->|all trades| CP
    CP -->|realisedSeries\nrealised + unrealised| RC
    CO -->|displayRows| CS
    CS -->|stats| RC
    R8 --> CO
    R8 --> RT
    R8 --> RC
    R8 --> ROC
    Trades -->|all trades| ROC
```

**Key invariants visible here:**
- `lotEngine` is the single source of truth for lot arithmetic (net cost, assigned-PUT premium credit).
- `computePnl` and `calcPremiumStats` answer different questions and must not be conflated — see CONTEXT.md.
- `render()` is a pure re-render from current `trades[]`; there is no incremental update path.
- `livePrices{}` (populated by the CoinGecko fetch) flows into `computePnl` for unrealised P&L only.
```
