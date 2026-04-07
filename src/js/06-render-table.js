// Sort state — persists across renders
let tSortOpen = { col: 'date', dir: 'desc' };
let tSortHist = { col: 'date', dir: 'desc' };

const _SORT_DESC_DEFAULT = ['date', 'expiry', 'strike', 'premium', 'annual'];

function sortOpen(col) {
  if (tSortOpen.col === col) {
    tSortOpen.dir = tSortOpen.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tSortOpen.col = col;
    tSortOpen.dir = _SORT_DESC_DEFAULT.includes(col) ? 'desc' : 'asc';
  }
  render();
}

function sortHist(col) {
  if (tSortHist.col === col) {
    tSortHist.dir = tSortHist.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tSortHist.col = col;
    tSortHist.dir = _SORT_DESC_DEFAULT.includes(col) ? 'desc' : 'asc';
  }
  render();
}

function _sortRows(rows, s) {
  const m = s.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[s.col], vb = b[s.col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return va.localeCompare(vb) * m;
    return (va < vb ? -1 : va > vb ? 1 : 0) * m;
  });
}

function _th(label, col, s, fn) {
  const active = s.col === col;
  const arrow = active ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return '<th class="th-sort' + (active ? ' th-sort-act' : '') + '" onclick="' + fn + '(\'' + col + '\')">'
    + label + (active ? '<span class="sort-arrow">' + arrow + '</span>' : '') + '</th>';
}

function _outcomeLabel(r) {
  if (r.outcome === 'EXPIRED')  return r.type === 'CALL' ? 'Returned (Kept Asset)' : 'Returned (Kept Premium)';
  if (r.outcome === 'ASSIGNED') return 'Assigned (Bought at Strike)';
  if (r.outcome === 'CALLED')   return 'Called Away (Sold at Strike)';
  if (r.outcome === 'CLOSED')   return 'Closed';
  return r.outcome;
}

function _outcomeCls(r) {
  if (r.outcome === 'ASSIGNED') return 'bass';
  if (r.outcome === 'CALLED')   return 'bcal';
  return 'bexp';
}

function _openHeaders() {
  const s = tSortOpen, fn = 'sortOpen';
  return _th('Asset','asset',s,fn) + _th('Platform','platform',s,fn) + _th('Date','date',s,fn)
    + _th('Expiry','expiry',s,fn) + _th('DTE','dte',s,fn) + _th('Type','type',s,fn)
    + _th('Strike','strike',s,fn) + _th('Size','size',s,fn) + _th('Premium','premium',s,fn)
    + _th('APR','annual',s,fn) + '<th></th>';
}

function _histHeaders() {
  const s = tSortHist, fn = 'sortHist';
  return _th('Asset','asset',s,fn) + _th('Platform','platform',s,fn) + _th('Date','date',s,fn)
    + _th('Expiry','expiry',s,fn) + _th('DTE','dte',s,fn) + _th('Type','type',s,fn)
    + _th('Strike','strike',s,fn) + _th('Size','size',s,fn) + _th('Premium','premium',s,fn)
    + _th('APR','annual',s,fn) + _th('Outcome','outcome',s,fn) + '<th></th>';
}

function _openRow(r) {
  const assetCls = { BTC:'bbtc', ETH:'beth', HYPE:'bhype', SOL:'bsol' }[r.asset] || 'bbtc';
  const isHolding = r.type === 'HOLDING';
  const typeBadge = isHolding
    ? '<span class="badge bholding">&#9632; SPOT</span>'
    : '<span class="badge b' + r.type.toLowerCase() + '">' + r.type + '</span>';
  const platBadge = isHolding
    ? '<span class="mu" style="font-size:.65rem">&mdash;</span>'
    : (r.platform === 'HSFC' ? '<span class="bplat bplat-hsfc">HSFC</span>' : '<span class="bplat bplat-rysk">RYSK</span>');
  const aprStr = isHolding ? '&mdash;'
    : '<span style="font-weight:700;color:' + (r.annual > 0 ? 'var(--green)' : 'var(--mu2)') + '">'
      + (r.annual !== null ? r.annual.toFixed(1) + '%' : '&mdash;') + '</span>';
  const actions = isHolding ? '' : (r.type === 'CALL'
    ? '<button class="btn-qa btn-qa-exp" onclick="quickOutcome(' + r.id + ',\'EXPIRED\')" title="Mark expired">Exp \u2713</button>'
      + '<button class="btn-qa btn-qa-cal" onclick="quickOutcome(' + r.id + ',\'CALLED\')" title="Mark called away">Called \u2191</button>'
    : '<button class="btn-qa btn-qa-exp" onclick="quickOutcome(' + r.id + ',\'EXPIRED\')" title="Mark expired">Exp \u2713</button>'
      + '<button class="btn-qa btn-qa-asg" onclick="quickOutcome(' + r.id + ',\'ASSIGNED\')" title="Mark assigned">Asgn \u2193</button>');
  return '<tr>'
    + '<td><span class="badge ' + assetCls + '">' + r.asset + '</span></td>'
    + '<td>' + platBadge + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + r.date + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + (isHolding ? '&mdash;' : (r.expiry || '&mdash;')) + '</td>'
    + '<td class="mu">' + (isHolding ? '&mdash;' : (r.dte || '&mdash;')) + '</td>'
    + '<td>' + typeBadge + '</td>'
    + '<td>$' + fmt(r.strike) + (isHolding ? '<br><span style="font-size:.65rem;color:var(--mu)">cost basis</span>' : '') + '</td>'
    + '<td class="mu">' + r.size + ' ' + r.asset + '</td>'
    + '<td class="' + (isHolding ? 'mu' : 'cr') + '">' + (isHolding ? '&mdash;' : '+$' + fmt(r.premium)) + '</td>'
    + '<td>' + aprStr + '</td>'
    + '<td class="td-act"><div class="row-actions">' + actions
      + '<button class="btn-qa" onclick="openEditModal(' + r.id + ')" title="Edit" style="color:var(--mu2)">&#9998;</button>'
      + '<button class="btn-d" onclick="deleteTrade(' + r.id + ')" title="Delete">&#10005;</button>'
      + '</div></td>'
    + '</tr>';
}

function _histRow(r) {
  const assetCls = { BTC:'bbtc', ETH:'beth', HYPE:'bhype', SOL:'bsol' }[r.asset] || 'bbtc';
  const typeBadge = '<span class="badge b' + r.type.toLowerCase() + '">' + r.type + '</span>';
  const platBadge = r.platform === 'HSFC' ? '<span class="bplat bplat-hsfc">HSFC</span>' : '<span class="bplat bplat-rysk">RYSK</span>';
  const aprStr = '<span style="font-weight:700;color:' + (r.annual > 0 ? 'var(--green)' : 'var(--mu2)') + '">'
    + (r.annual !== null ? r.annual.toFixed(1) + '%' : '&mdash;') + '</span>';
  return '<tr>'
    + '<td><span class="badge ' + assetCls + '">' + r.asset + '</span></td>'
    + '<td>' + platBadge + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + r.date + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + (r.expiry || '&mdash;') + '</td>'
    + '<td class="mu">' + (r.dte || '&mdash;') + '</td>'
    + '<td>' + typeBadge + '</td>'
    + '<td>$' + fmt(r.strike) + '</td>'
    + '<td class="mu">' + r.size + ' ' + r.asset + '</td>'
    + '<td class="cr">+$' + fmt(r.premium) + '</td>'
    + '<td>' + aprStr + '</td>'
    + '<td><span class="badge ' + _outcomeCls(r) + '">' + _outcomeLabel(r) + '</span></td>'
    + '<td class="td-act"><div class="row-actions">'
      + '<button class="btn-qa" onclick="openEditModal(' + r.id + ')" title="Edit" style="color:var(--mu2)">&#9998;</button>'
      + '<button class="btn-d" onclick="deleteTrade(' + r.id + ')" title="Delete">&#10005;</button>'
      + '</div></td>'
    + '</tr>';
}

function rStats(streams, lots, displayRows) {
  renderExpiryTable();
}

function renderExpiryTable() {
  const wrap = document.getElementById('expiry-table-wrap');
  if (!wrap) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);

  const expiring = trades.filter(t => {
    if (t.outcome !== 'OPEN') return false;
    if (t.type !== 'PUT' && t.type !== 'CALL') return false;
    if (sFilter !== 'ALL' && t.asset !== sFilter) return false;
    if (!t.expiry) return false;
    const exp = new Date(t.expiry + 'T00:00:00');
    return exp <= weekOut;
  }).sort((a, b) => new Date(a.expiry) - new Date(b.expiry) || a.asset.localeCompare(b.asset));

  if (!expiring.length) {
    wrap.innerHTML = '<div class="exp-empty">No trades expiring this week</div>';
    return;
  }

  const assetCol = { BTC: 'btc', ETH: 'eth', HYPE: 'hype', SOL: 'sol' };

  const rows = expiring.map(t => {
    const exp = new Date(t.expiry + 'T00:00:00');
    const daysLeft = Math.round((exp - today) / (1000 * 60 * 60 * 24));
    const dteLabel = daysLeft <= 0
      ? '<span style="color:var(--red);font-weight:700">today</span>'
      : daysLeft + 'd';

    let aprHtml = '—';
    if (t.dte > 0 && t.strike > 0 && t.size > 0) {
      const ann = (t.premium / (t.strike * t.size)) * (365 / t.dte) * 100;
      aprHtml = ann.toFixed(1) + '%';
    }

    let statusHtml = '<span style="color:var(--mu)">—</span>';
    const spot = livePrices[t.asset];
    if (spot) {
      const isPut = t.type === 'PUT';
      const isOTM = isPut ? spot > t.strike : spot < t.strike;
      const pct = Math.abs((spot - t.strike) / spot * 100).toFixed(1);
      statusHtml = isOTM
        ? '<span class="exp-otm">OTM ' + pct + '%</span>'
        : '<span class="exp-itm">ITM ' + pct + '%</span>';
    }

    const col = assetCol[t.asset] || 'mu2';
    const platBadge = (t.platform === 'HSFC')
      ? '<span class="bplat bplat-hsfc">HSFC</span>'
      : '<span class="bplat bplat-rysk">RYSK</span>';
    return '<tr>'
      + '<td style="color:var(--' + col + ');font-weight:700">' + t.asset + '</td>'
      + '<td>' + t.type + '</td>'
      + '<td>$' + fmt(t.strike) + '</td>'
      + '<td>' + dteLabel + '</td>'
      + '<td>$' + fmt(t.premium) + '</td>'
      + '<td>' + aprHtml + '</td>'
      + '<td>' + statusHtml + '</td>'
      + '<td>' + platBadge + '</td>'
      + '</tr>';
  }).join('');

  wrap.innerHTML = '<table class="expiry-tbl">'
    + '<thead><tr><th>Asset</th><th>Strategy</th><th>Strike</th><th>DTE</th><th>Premium</th><th>APR</th><th>Status</th><th>Platform</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>';
}

function fetchExpiryPrices() {
  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,hyperliquid,solana&vs_currencies=usd')
    .then(r => r.json())
    .then(data => {
      livePrices = {
        BTC:  data.bitcoin     && data.bitcoin.usd,
        ETH:  data.ethereum    && data.ethereum.usd,
        HYPE: data.hyperliquid && data.hyperliquid.usd,
        SOL:  data.solana      && data.solana.usd,
      };
      const el = document.getElementById('expiry-last-refreshed');
      if (el) { const n = new Date(); el.textContent = 'refreshed ' + String(n.getUTCHours()).padStart(2,'0') + ':' + String(n.getUTCMinutes()).padStart(2,'0') + ' UTC'; }
      renderExpiryTable();
    })
    .catch(() => { /* silently fail — table shows — for status */ });
}

function rTable(displayRows, streams, lots) {
  const ncWrap   = document.getElementById('ncbwrap');
  const cntEl    = document.getElementById('tcnt');
  const openBody = document.getElementById('ttbody-open');
  const histBody = document.getElementById('ttbody-hist');
  const openHdr  = document.getElementById('open-hdr');
  const histHdr  = document.getElementById('hist-hdr');
  const ocntEl   = document.getElementById('ocnt');
  const hcntEl   = document.getElementById('hcnt');

  if (!displayRows.length) {
    if (openHdr)  openHdr.innerHTML  = _openHeaders();
    if (histHdr)  histHdr.innerHTML  = _histHeaders();
    if (openBody) openBody.innerHTML = '<tr><td colspan="11"><div class="empty"><div class="empty-icon">&#9678;</div><div class="empty-title">No trades logged yet</div><div class="empty-sub">Start by logging your first position \u2014 a PUT, CALL, or spot HOLDING. Your P&amp;L, net cost basis, and premium income will appear here automatically.</div><button class="empty-cta" onclick="openTradeDrawer()">+ LOG FIRST TRADE</button></div></td></tr>';
    if (histBody) histBody.innerHTML = '';
    ncWrap.innerHTML = ''; cntEl.textContent = '';
    if (ocntEl) ocntEl.textContent = '';
    if (hcntEl) hcntEl.textContent = '';
    return;
  }

  cntEl.textContent = displayRows.length + ' trade' + (displayRows.length !== 1 ? 's' : '');

  // Net cost banners — one card per open LOT
  let bannerHtml = '';
  ['BTC','ETH','HYPE','SOL'].forEach(a => {
    if (sFilter !== 'ALL' && sFilter !== a) return;
    const assetLots = (lots[a] || []).filter(l => l.open);
    if (!assetLots.length) return;
    const col = { BTC:'btc', ETH:'eth', HYPE:'hype', SOL:'sol' }[a] || 'mu2';
    const totalLots = (lots[a] || []).length;
    if (assetLots.length >= 2) {
      bannerHtml += '<div style="margin-bottom:4px;text-align:right"><button class="btn-merge" onclick="openMergeModal(\'' + a + '\')">Merge ' + a + ' Lots</button></div>';
    }
    assetLots.forEach(lot => {
      const nc = lot.costBasis - (lot.lotPremiums / lot.size);
      const lotLabel = totalLots > 1 ? a + ' Lot ' + lot.lotNum : a + ' Held';
      const reduction = lot.costBasis - nc;
      bannerHtml += '<div class="ncb" style="margin-bottom:8px">'
        + '<div class="nci"><div class="ncl">' + lotLabel + '</div><div class="ncv ' + col + '">' + lot.size + ' ' + a + '</div></div>'
        + '<div class="nci"><div class="ncl">Cost Basis</div><div class="ncv" style="color:var(--mu2)">$' + fmt(lot.costBasis) + '</div></div>'
        + '<div class="nci"><div class="ncl">CC Premiums</div><div class="ncv green">$' + fmt(lot.lotPremiums) + '</div></div>'
        + '<div class="nci"><div class="ncl">Net Cost / ' + a + '</div><div class="ncv orange">$' + fmt(nc) + '</div></div>'
        + '<div class="nci"><div class="ncl">Reduced by</div><div class="ncv green">$' + fmt(reduction) + '</div></div>'
        + '<div class="nci"><div class="ncl">Breakeven</div><div class="ncv" style="color:var(--mu2)">$' + fmt(nc) + '</div></div>'
        + '</div>';
    });
  });
  ncWrap.innerHTML = bannerHtml ? '<div style="padding:16px 20px 0">' + bannerHtml + '</div>' : '';

  // Split into open and history
  const openRows = displayRows.filter(r => r.outcome === 'OPEN');
  const histRows = displayRows.filter(r => r.outcome !== 'OPEN' && r.type !== 'HOLDING');

  if (ocntEl) ocntEl.textContent = openRows.length ? String(openRows.length) : '';
  if (hcntEl) hcntEl.textContent = histRows.length ? String(histRows.length) : '';

  // Render headers with current sort state
  if (openHdr) openHdr.innerHTML = _openHeaders();
  if (histHdr) histHdr.innerHTML = _histHeaders();

  // Open positions
  const sortedOpen = _sortRows(openRows, tSortOpen);
  if (openBody) openBody.innerHTML = sortedOpen.length
    ? sortedOpen.map(_openRow).join('')
    : '<tr><td colspan="11" style="padding:14px 12px;color:var(--mu);font-size:.75rem;text-align:center;font-family:var(--mono)">No open positions</td></tr>';

  // Position history
  const sortedHist = _sortRows(histRows, tSortHist);
  if (histBody) histBody.innerHTML = sortedHist.length
    ? sortedHist.map(_histRow).join('')
    : '<tr><td colspan="12" style="padding:14px 12px;color:var(--mu);font-size:.75rem;text-align:center;font-family:var(--mono)">No closed positions yet</td></tr>';
}
