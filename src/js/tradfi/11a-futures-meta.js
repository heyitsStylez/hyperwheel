// Registers futures contract multipliers as overrides on the core
// ASSET_MULTIPLIER registry (01b-asset-meta.js). Equity/ETF tickers keep the
// default 100 shares/contract; futures options control one futures contract at
// their index-point multiplier. Add more (ES:50, MNQ:2, M2K:5, …) here as
// needed. Runs at load after 01b-asset-meta.js.
Object.assign(ASSET_MULTIPLIER, { MES: 5 });
