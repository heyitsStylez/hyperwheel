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

function _openHeaders() {
  const s = tSortOpen, fn = 'sortOpen';
  return _th('Asset','asset',s,fn) + _th('Platform','platform',s,fn) + _th('Date','date',s,fn)
    + _th('Expiry','expiry',s,fn) + _th('DTE','expiry',s,fn) + _th('Type','type',s,fn)
    + _th('Strike','strike',s,fn) + _th('Size','size',s,fn) + _th('Premium','premium',s,fn)
    + _th('APR','annual',s,fn) + '<th></th>';
}

function _histHeaders() {
  const s = tSortHist, fn = 'sortHist';
  return _th('Asset','asset',s,fn) + _th('Platform','platform',s,fn) + _th('Date','date',s,fn)
    + _th('Expiry','expiry',s,fn) + _th('Term','dte',s,fn) + _th('Type','type',s,fn)
    + _th('Strike','strike',s,fn) + _th('Size','size',s,fn) + _th('Premium','premium',s,fn)
    + _th('APR','annual',s,fn) + _th('Outcome','outcome',s,fn) + '<th></th>';
}

function _liveDte(expiry) {
  if (!expiry) return '&mdash;';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + 'T00:00:00');
  const days = Math.round((exp - today) / 86400000);
  if (days <= 0) return '<span style="color:var(--red);font-weight:700">today</span>';
  return days + 'd';
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
    + '<td class="mu">' + (isHolding ? '&mdash;' : _liveDte(r.expiry)) + '</td>'
    + '<td>' + typeBadge + '</td>'
    + '<td>$' + fmt(r.strike) + (isHolding ? '<br><span style="font-size:.65rem;color:var(--mu)">cost basis</span>' : '') + '</td>'
    + '<td class="mu">' + r.size + ' ' + r.asset + '</td>'
    + '<td class="' + (isHolding ? 'mu' : 'cr') + '">' + (isHolding ? '&mdash;' : '+$' + fmt(r.premium)) + '</td>'
    + '<td>' + aprStr + '</td>'
    + '<td class="td-act"><div class="row-actions">' + actions
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
  const corrBtn = r.outcome === 'EXPIRED' && r.type === 'CALL'
    ? '<button class="btn-qa btn-qa-cal" onclick="quickOutcome(' + r.id + ',\'CALLED\')" title="Mark called away">Called \u2191</button>'
    : r.outcome === 'EXPIRED' && r.type === 'PUT'
    ? '<button class="btn-qa btn-qa-asg" onclick="quickOutcome(' + r.id + ',\'ASSIGNED\')" title="Mark assigned">Asgn \u2193</button>'
    : '';
  return '<tr>'
    + '<td><span class="badge ' + assetCls + '">' + r.asset + '</span></td>'
    + '<td>' + platBadge + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + r.date + '</td>'
    + '<td class="mu" style="font-size:.72rem">' + (r.expiry || '&mdash;') + '</td>'
    + '<td class="mu">' + (r.dte || '&mdash;') + '</td>'
    + '<td>' + typeBadge + '</td>'
    + '<td>$' + fmt(r.strike) + '</td>'
    + '<td class="mu">' + r.size + ' ' + r.asset + '</td>'
    + '<td class="cr">' + (r.outcome === 'CLOSED'
        ? '+$' + fmt(r.premium - (r.closeCost || 0)) + '<br><span style="font-size:.6rem;color:var(--mu)">-$' + fmt(r.closeCost || 0) + ' to close</span>'
        : '+$' + fmt(r.premium)) + '</td>'
    + '<td>' + aprStr + '</td>'
    + '<td><span class="badge ' + outcomeBadge(r.outcome) + '">' + outcomeLabel(r) + '</span></td>'
    + '<td class="td-act"><div class="row-actions">' + corrBtn
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

  // Today badge in section header — count of trades expiring today or overdue
  const todayBadge = document.getElementById('expiry-today-badge');
  if (todayBadge) {
    const todayCount = expiring.filter(t => {
      const exp = new Date(t.expiry + 'T00:00:00');
      return Math.round((exp - today) / 86400000) <= 0;
    }).length;
    if (todayCount > 0) {
      todayBadge.textContent = todayCount + ' today';
      todayBadge.style.display = '';
    } else {
      todayBadge.style.display = 'none';
    }
  }

  if (!expiring.length) {
    wrap.innerHTML = '<div class="exp-empty">No trades expiring this week</div>';
    return;
  }

  const assetCol = { BTC: 'btc', ETH: 'eth', HYPE: 'hype', SOL: 'sol' };

  const enriched = expiring.map(t => {
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
    const actionsHtml = '<div class="row-actions">'
      + '<button class="btn-qa btn-qa-exp" onclick="quickOutcome(' + t.id + ',\'EXPIRED\')" title="Mark expired">Exp \u2713</button>'
      + (t.type === 'CALL'
        ? '<button class="btn-qa btn-qa-cal" onclick="quickOutcome(' + t.id + ',\'CALLED\')" title="Mark called away">Called \u2191</button>'
        : '<button class="btn-qa btn-qa-asg" onclick="quickOutcome(' + t.id + ',\'ASSIGNED\')" title="Mark assigned">Asgn \u2193</button>')
      + '</div>';
    return { t, col, dteLabel, aprHtml, statusHtml, platBadge, actionsHtml, daysLeft };
  });

  const rows = enriched.map(e => {
    const t = e.t;
    return '<tr>'
      + '<td><span class="badge b' + e.col + '">' + t.asset + '</span></td>'
      + '<td>' + e.platBadge + '</td>'
      + '<td><span class="badge b' + t.type.toLowerCase() + '">' + t.type + '</span></td>'
      + '<td>$' + fmt(t.strike) + '</td>'
      + '<td>' + fmt(t.size) + '</td>'
      + '<td>' + e.dteLabel + '</td>'
      + '<td>$' + fmt(t.premium) + '</td>'
      + '<td>' + e.aprHtml + '</td>'
      + '<td>' + e.statusHtml + '</td>'
      + '<td class="td-act">' + e.actionsHtml + '</td>'
      + '</tr>';
  }).join('');

  const cards = enriched.map(e => {
    const t = e.t;
    return '<div class="exp-card' + (e.daysLeft <= 0 ? ' exp-card-today' : '') + '">'
      + '<div class="exp-card-row1">'
      +   '<span class="exp-card-asset" style="color:var(--' + e.col + ')">' + t.asset + '</span>'
      +   '<span class="exp-card-type">' + t.type + '</span>'
      +   '<span class="exp-card-dte">' + e.dteLabel + '</span>'
      +   e.platBadge
      + '</div>'
      + '<div class="exp-card-row2">'
      +   '<div><span class="exp-card-lbl">Strike</span> $' + fmt(t.strike) + '</div>'
      +   '<div><span class="exp-card-lbl">Size</span> ' + fmt(t.size) + '</div>'
      +   '<div><span class="exp-card-lbl">Prem</span> $' + fmt(t.premium) + '</div>'
      +   '<div><span class="exp-card-lbl">APR</span> ' + e.aprHtml + '</div>'
      +   '<div class="exp-card-status">' + e.statusHtml + '</div>'
      + '</div>'
      + '<div class="exp-card-row3">' + e.actionsHtml + '</div>'
      + '</div>';
  }).join('');

  wrap.innerHTML = '<table class="expiry-tbl">'
    + '<thead><tr><th>Asset</th><th>Platform</th><th>Type</th><th>Strike</th><th>Size</th><th>DTE</th><th>Premium</th><th>APR</th><th>Status</th><th></th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '<div class="exp-cards">' + cards + '</div>';
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
      // Re-render whole page so holdings cards pick up live spot too
      if (typeof render === 'function') render(); else renderExpiryTable();
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

  // Holdings cards — one card per open lot
  const sym = { BTC:'&#9654;', ETH:'&#9670;', HYPE:'&#9632;', SOL:'&#9679;' };
  let cardsHtml = '';
  let mergesHtml = '';
  let openLotCount = 0;
  ['BTC','ETH','HYPE','SOL'].forEach(a => {
    if (sFilter !== 'ALL' && sFilter !== a) return;
    const assetLots = (lots[a] || []).filter(l => l.open);
    if (!assetLots.length) return;
    const col = { BTC:'btc', ETH:'eth', HYPE:'hype', SOL:'sol' }[a];
    const totalAssetLots = (lots[a] || []).length;
    if (assetLots.length >= 2) {
      mergesHtml += '<button class="btn-merge" onclick="openMergeModal(\'' + a + '\')">Merge ' + a + ' Lots</button>';
    }
    assetLots.forEach(lot => {
      openLotCount++;
      const nc = lot.netCost;
      const reductionPct = lot.costBasis > 0 ? ((lot.costBasis - nc) / lot.costBasis * 100) : 0;
      const lotBadge = totalAssetLots > 1 ? '<span class="lot-badge">Lot ' + lot.lotNum + '</span>' : '';
      const holdingTrade = trades.find(t => t.id === lot.tradeIds[0]);
      const isManualHolding = holdingTrade && holdingTrade.type === 'HOLDING';
      const editBtn = isManualHolding
        ? '<button class="hcard-edit" onclick="openEditModal(' + lot.tradeIds[0] + ')" title="Edit holding">&#9998;</button>'
        : '';
      // Live spot, unrealized P&L vs net cost, breakeven hint
      const spot = livePrices[a];
      let spotBlock;
      if (!spot) {
        spotBlock = '<div class="hcard-spot hcard-spot-placeholder">'
          +   '<div class="hcard-spot-row">'
          +     '<span class="hcard-spot-lbl">Spot</span>'
          +     '<span class="hcard-spot-val hcard-spot-muted">&mdash;</span>'
          +   '</div>'
          +   '<div class="hcard-hint">spot unavailable</div>'
          + '</div>';
      } else {
        const pnlPerToken = spot - nc;
        const pnlTotal = pnlPerToken * lot.size;
        const pnlPct = nc > 0 ? (pnlPerToken / nc * 100) : 0;
        const cls = pnlTotal >= 0 ? 'green' : 'red';
        const sign = pnlTotal >= 0 ? '+' : '';
        let hint;
        if (nc > spot) {
          const need = ((nc - spot) / spot * 100).toFixed(1);
          hint = '<div class="hcard-hint">Next call &ge; <b>$' + fmt(nc) + '</b> &mdash; ' + need + '% above spot to stay above net cost</div>';
        } else {
          const cushion = ((spot - nc) / spot * 100).toFixed(1);
          hint = '<div class="hcard-hint hcard-hint-ok">Spot is ' + cushion + '% above net cost &mdash; any call &ge; spot is profitable</div>';
        }
        spotBlock = '<div class="hcard-spot">'
          +   '<div class="hcard-spot-row">'
          +     '<span class="hcard-spot-lbl">Spot</span>'
          +     '<span class="hcard-spot-val">$' + fmt(spot) + '</span>'
          +     '<span class="hcard-pnl ' + cls + '">' + sign + '$' + fmt(pnlTotal) + ' (' + sign + pnlPct.toFixed(1) + '%)</span>'
          +   '</div>'
          +   hint
          + '</div>';
      }

      cardsHtml += '<div class="hcard hcard-' + col + '">'
        + '<div class="hcard-hd">'
        +   '<div class="hcard-asset">'
        +     '<span class="hcard-ticker hct-' + col + '">' + sym[a] + ' ' + a + '</span>'
        +     '<span class="hcard-size">' + fmt(lot.size) + '</span>'
        +     lotBadge
        +   '</div>'
        +   '<div style="display:flex;align-items:center;gap:8px">'
        +     (lot.startDate ? '<span class="hcard-date">since ' + lot.startDate + '</span>' : '')
        +     editBtn
        +   '</div>'
        + '</div>'
        + '<div class="hcard-hero has-tip" data-tip="Net Cost = costBasis − (lotPremiums / size). A premium-reduced entry-price lens — what you effectively paid per token after the wheel premiums worked for you. Different from Unrealised P&amp;L, which marks the lot to spot against raw costBasis (not netCost).">'
        +   '<div class="hcard-hero-lbl">Net Cost / ' + a + ' <span class="tip-ico" aria-hidden="true">&#9432;</span></div>'
        +   '<div class="hcard-hero-val">$' + fmt(nc) + '</div>'
        + '</div>'
        + spotBlock
        + '<div class="hcard-stats">'
        +   '<div class="hcard-stat"><div class="hcard-stat-lbl">Cost Basis</div><div class="hcard-stat-val">$' + fmt(lot.costBasis) + '</div></div>'
        +   '<div class="hcard-stat"><div class="hcard-stat-lbl">CC Premiums</div><div class="hcard-stat-val green">$' + fmt(lot.lotPremiums) + '</div></div>'
        +   '<div class="hcard-stat"><div class="hcard-stat-lbl">Premium Reduction %</div><div class="hcard-stat-val green">' + reductionPct.toFixed(1) + '%</div></div>'
        + '</div>'
        + '</div>';
    });
  });
  if (cardsHtml) {
    ncWrap.innerHTML = '<div class="sec holdings-sec">'
      + '<div class="sec-hd">'
      +   '<div class="sec-ttl"><span class="dot dg"></span>Holdings</div>'
      +   '<span style="font-size:.6rem;color:var(--mu);font-family:var(--mono)">' + openLotCount + ' open lot' + (openLotCount !== 1 ? 's' : '') + '</span>'
      + '</div>'
      + '<div class="holdings-grid' + (openLotCount <= 2 ? ' holdings-grid--wide' : '') + '">' + cardsHtml + '</div>'
      + (mergesHtml ? '<div class="holdings-merges">' + mergesHtml + '</div>' : '')
      + '</div>';
  } else {
    ncWrap.innerHTML = '';
  }

  // Split into open and history
  const openRows = displayRows.filter(r => r.outcome === 'OPEN' && r.type !== 'HOLDING');
  let histRows = displayRows.filter(r => r.outcome !== 'OPEN' && r.type !== 'HOLDING');

  // Apply history filters (outcome + date range, by trade open date)
  if (sHistOutcome && sHistOutcome !== 'ALL') {
    histRows = histRows.filter(r => r.outcome === sHistOutcome);
  }
  if (sHistFrom) histRows = histRows.filter(r => r.date >= sHistFrom);
  if (sHistTo)   histRows = histRows.filter(r => r.date <= sHistTo);

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

function exportHistoryCSV() {
  const c = compute(sFilter);
  let rows = c.displayRows.filter(r => r.outcome !== 'OPEN' && r.type !== 'HOLDING');
  if (sHistOutcome && sHistOutcome !== 'ALL') rows = rows.filter(r => r.outcome === sHistOutcome);
  if (sHistFrom) rows = rows.filter(r => r.date >= sHistFrom);
  if (sHistTo)   rows = rows.filter(r => r.date <= sHistTo);
  rows = _sortRows(rows, tSortHist);

  if (!rows.length) { toast('No history rows to export', 'info'); return; }

  const cols = ['date','asset','type','platform','expiry','dte','strike','size','premium','closeCost','net_premium','outcome','apr_pct','lotNum','txHash','notes','id'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  rows.forEach(r => {
    const net = (r.premium || 0) - (r.closeCost || 0);
    lines.push([
      r.date, r.asset, r.type, r.platform, r.expiry || '', r.dte || '',
      r.strike, r.size, r.premium, r.closeCost || 0, net, r.outcome,
      r.annual != null ? r.annual.toFixed(2) : '',
      r.lotNum || '', r.txHash || '', r.notes || '', r.id
    ].map(esc).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[-:T]/g,'').slice(0,15);
  a.href = url;
  a.download = 'hyperwheel-history-' + stamp + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Exported ' + rows.length + ' row' + (rows.length !== 1 ? 's' : ''), 'ok');
}
