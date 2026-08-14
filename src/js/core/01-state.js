const HW_WALLET_KEY   = 'hw_wallet';
const HW_HOLDINGS_KEY = 'hw_holdings';
const HW_SYNCED_KEY   = 'hw_synced_v1';

let trades = [];
let sAsset = 'BTC', sType = 'PUT', sOut = 'OPEN', sFilter = 'ALL', sPlatform = 'RYSK', sSizeUnit = 'contracts', sPpnlTab = 'total', sCpnlPeriod = 'ALL';
// Wheeler-only display unit for option/holding `size`: 'contracts' | 'shares'
// (crypto ignores it — see fmtSize in 06-render-table.js).
let sSizeDisplay = 'contracts';
var livePrices = {};

// Per-ticker colour + contract minimum live in 01b-asset-meta.js (assetColor /
// minSize), with crypto brand overrides in crypto/11a-asset-brand.js.

// Merge modal state
let mergeAsset = null;

// History filter state
let sHistOutcome = 'ALL';  // ALL | EXPIRED | ASSIGNED | CALLED | CLOSED
let sHistFrom = '';        // YYYY-MM-DD or empty
let sHistTo   = '';
