// ── CRYPTO ASSET BRANDING ─────────────────────────────────────
// Register crypto brand colours + Rysk contract minimums as overrides on the
// core asset-meta registries. assetColor()/minSize() consult these first,
// falling back to hash colour / no minimum for arbitrary tickers.
Object.assign(ASSET_BRAND, { BTC: '#f7931a', ETH: '#627eea', HYPE: '#00e5a0', SOL: '#9945ff' });
Object.assign(ASSET_MIN_SIZE, { BTC: 0.05, ETH: 0.5, HYPE: 50, SOL: 10 });
