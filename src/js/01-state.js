const HW_WALLET_KEY   = 'hw_wallet';
const HW_HOLDINGS_KEY = 'hw_holdings';
const HW_SYNCED_KEY   = 'hw_synced_v1';

let trades = [];
let sAsset = 'BTC', sType = 'PUT', sOut = 'OPEN', sFilter = 'ALL', sPlatform = 'RYSK', sSizeUnit = 'contracts', sPpnlTab = 'total', sCpnlPeriod = 'ALL';
var livePrices = {};

const MIN_SIZE = { BTC: 0.05, ETH: 0.5, HYPE: 50, SOL: 10 };
const ASSET_COLORS = { BTC: '#f7931a', ETH: '#627eea', HYPE: '#00e5a0', SOL: '#9945ff' };

// Merge modal state
let mergeAsset = null;

// History filter state
let sHistOutcome = 'ALL';  // ALL | EXPIRED | ASSIGNED | CALLED | CLOSED
let sHistFrom = '';        // YYYY-MM-DD or empty
let sHistTo   = '';
