const KEY = 'rysk_wheel_v4';
let trades = [];
let sAsset = 'BTC', sType = 'PUT', sOut = 'OPEN', sFilter = 'ALL', sPlatform = 'RYSK', sSizeUnit = 'contracts', sPpnlTab = 'total', sCpnlPeriod = 'ALL';
let livePrices = {};

const MIN_SIZE = { BTC: 0.05, ETH: 0.5, HYPE: 50, SOL: 10 };
const ASSET_COLORS = { BTC: '#f7931a', ETH: '#627eea', HYPE: '#00e5a0', SOL: '#9945ff' };

// Cloud sync state
const SYNC_CODE_KEY = 'rysk_sync_code_v1';
const SYNC_LAST_KEY = 'rysk_sync_last_v1';
let cloudPullData = null;
let syncCodeChangeVisible = false;

// Edit modal state
let editingId = null;

// Merge modal state
let mergeAsset = null;

// Auto sync state
let autoSyncTimer = null;
