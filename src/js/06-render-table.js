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

    // APR using original DTE at entry
    let aprHtml = '—';
    if (t.dte > 0 && t.strike > 0 && t.size > 0) {
      const ann = (t.premium / (t.strike * t.size)) * (365 / t.dte) * 100;
      aprHtml = ann.toFixed(1) + '%';
    }

    // Status: OTM / ITM using live prices if available
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
  const tbody  = document.getElementById('ttbody');
  const ncWrap = document.getElementById('ncbwrap');
  const cntEl  = document.getElementById('tcnt');

  if (!displayRows.length) {
    tbody.innerHTML = '<tr><td colspan="14"><div class="empty"><div class="empty-icon">&#9678;</div><div class="empty-title">No trades logged yet</div><div class="empty-sub">Start by logging your first position \u2014 a PUT, CALL, or spot HOLDING. Your P&amp;L, net cost basis, and premium income will appear here automatically.</div><button class="empty-cta" onclick="openTradeDrawer()">+ LOG FIRST TRADE</button></div></td></tr>';
    ncWrap.innerHTML = ''; cntEl.textContent = ''; return;
  }

  cntEl.textContent = displayRows.length + ' trade' + (displayRows.length!==1?'s':'');

  // Net cost banners — one card per open LOT (lot-aware multi-wheel)
  let bannerHtml = '';
  ['BTC','ETH','HYPE','SOL'].forEach(a => {
    if (sFilter !== 'ALL' && sFilter !== a) return;
    const assetLots = (lots[a] || []).filter(l => l.open);
    if (!assetLots.length) return;
    const col = { BTC:'btc', ETH:'eth', HYPE:'hype', SOL:'sol' }[a] || 'mu2';
    const totalLots = (lots[a] || []).length;

    // Show merge button if 2+ open lots for this asset
    if (assetLots.length >= 2) {
      bannerHtml += `<div style="margin-bottom:4px;text-align:right"><button class="btn-merge" onclick="openMergeModal('${a}')">Merge ${a} Lots</button></div>`;
    }
    assetLots.forEach(lot => {
      const nc = lot.costBasis - (lot.lotPremiums / lot.size);
      const lotLabel = totalLots > 1 ? `${a} Lot ${lot.lotNum}` : `${a} Held`;
      const reduction = lot.costBasis - nc;
      bannerHtml += `<div class="ncb" style="margin-bottom:8px">
        <div class="nci"><div class="ncl">${lotLabel}</div><div class="ncv ${col}">${lot.size} ${a}</div></div>
        <div class="nci"><div class="ncl">Cost Basis</div><div class="ncv" style="color:var(--mu2)">$${fmt(lot.costBasis)}</div></div>
        <div class="nci"><div class="ncl">CC Premiums</div><div class="ncv green">$${fmt(lot.lotPremiums)}</div></div>
        <div class="nci"><div class="ncl">Net Cost / ${a}</div><div class="ncv orange">$${fmt(nc)}</div></div>
        <div class="nci"><div class="ncl">Reduced by</div><div class="ncv green">$${fmt(reduction)}</div></div>
        <div class="nci"><div class="ncl">Breakeven</div><div class="ncv" style="color:var(--mu2)">$${fmt(nc)}</div></div>
      </div>`;
    });
  });
  if (bannerHtml) ncWrap.innerHTML = '<div style="padding:16px 20px 0">' + bannerHtml + '</div>';
  else ncWrap.innerHTML = '';

  const OMAP = { EXPIRED:'Expired &#10003;', ASSIGNED:'Assigned', CALLED:'Called Away', OPEN:'Open &#9679;', HOLDING:'&mdash;', CLOSED:'Closed &#10003;' };
  const OBDG = { EXPIRED:'bexp', ASSIGNED:'bass', CALLED:'bcal', OPEN:'bopn', HOLDING:'bholding', CLOSED:'bclosed' };

  let html = '', lastAsset = null, inCC = {}, lastLot = {};

  displayRows.forEach(r => {
    const assetLo = r.asset.toLowerCase();

    // Asset separator when showing ALL and switching assets in sorted order
    if (sFilter === 'ALL' && r.asset !== lastAsset) {
      html += `<tr class="asset-sep"><td colspan="14"><span class="badge b${assetLo}">${{ BTC:'&#9654;', ETH:'&#9670;', HYPE:'&#9632;', SOL:'&#9679;' }[r.asset] || '&#9632;'} ${r.asset} Trades</span></td></tr>`;
      lastAsset = r.asset;
    }

    // Lot group header — shown for every lot (single and multi)
    const prevLot = lastLot[r.asset];
    if (r.lotNum && r.lotNum !== prevLot) {
      lastLot[r.asset] = r.lotNum;
      const lotLabel = r.type === 'HOLDING' ? 'Spot Entry' : 'Assigned';
      html += `<tr class="psep la-${assetLo}"><td colspan="14">&#9632; ${r.asset} — Lot ${r.lotNum} (${lotLabel} @ $${fmt(r.lotCostBasis)})</td></tr>`;
    } else if (!r.lotNum && r.type === 'PUT') {
      // Unassigned put — portfolio-level separator (only if there are also lots for this asset)
      if (!lastLot['_put_' + r.asset] && (lots[r.asset] || []).length > 0) {
        lastLot['_put_' + r.asset] = true;
        html += `<tr class="psep la-${assetLo}"><td colspan="14">&#9654; ${r.asset} — Cash-Secured Put (portfolio level)</td></tr>`;
      }
    }

    // Fallback separator for CALL rows with no lot context (edge case: calls logged without a HOLDING)
    if (r.type === 'CALL' && !r.lotNum && !inCC[r.asset]) {
      inCC[r.asset] = true;
      html += `<tr class="psep la-${assetLo}"><td colspan="14">&#9654; ${r.asset} Covered Call Phase</td></tr>`;
    }

    const lotPnlCell = r.lotPnl !== null
      ? `<span class="cr">+$${fmt(r.lotPnl)}</span>`
      : '<span style="color:var(--mu)">&mdash;</span>';
    const coll = r.type === 'PUT' ? '$'+fmt(r.strike*r.size) : r.size+' '+r.asset;
    const assetCls = { BTC:'bbtc', ETH:'beth', HYPE:'bhype', SOL:'bsol' }[r.asset] || 'bbtc';
    const isHoldingRow = r.type === 'HOLDING';

    // APR display (single column replacing % Return / Mo% / Ann%)
    const fmtPct = (v, dp=1) => v !== null ? v.toFixed(dp) + '%' : '&mdash;';
    const aprColor = r.annual > 0 ? 'var(--green)' : 'var(--mu2)';
    const aprStr = isHoldingRow ? '&mdash;' : `<span style="font-weight:700;color:${aprColor}">${fmtPct(r.annual)}</span>`;
    const typeBadge = isHoldingRow
      ? '<span class="badge bholding">&#9632; SPOT</span>'
      : `<span class="badge b${r.type.toLowerCase()}">${r.type}</span>`;
    const outcomeBadge = isHoldingRow
      ? '<span style="color:var(--mu);font-size:.72rem">spot entry</span>'
      : `<span class="badge ${OBDG[r.outcome]}">${OMAP[r.outcome]}</span>`;
    // Lot clustering row classes
    let rowCls = '';
    if (r.lotNum) {
      if (r.type === 'HOLDING' || r.outcome === 'ASSIGNED') rowCls = `lot-head la-${assetLo}`;
      else if (r.type === 'CALL') rowCls = `lot-child la-${assetLo}`;
    }
    const platBadge = isHoldingRow ? '<span class="mu" style="font-size:.65rem">&mdash;</span>' : (r.platform === 'HSFC') ? '<span class="bplat bplat-hsfc">HSFC</span>' : '<span class="bplat bplat-rysk">RYSK</span>';
    const trStyle = isHoldingRow ? ' style="background:rgba(240,146,74,0.03)"' : '';
    html += `<tr${rowCls ? ' class="' + rowCls + '"' : ''}${trStyle}>
      <td><span class="badge ${assetCls}">${r.asset}</span></td>
      <td>${platBadge}</td>
      <td class="mu" style="font-size:.72rem">${r.lotNum ? 'L'+r.lotNum : '&mdash;'}</td>
      <td>${r.date}</td>
      <td class="mu">${isHoldingRow ? '&mdash;' : r.expiry}</td>
      <td class="mu">${isHoldingRow ? '&mdash;' : (r.dte||'&mdash;')}</td>
      <td>${typeBadge}</td>
      <td>$${fmt(r.strike)}<br><span style="font-size:.65rem;color:var(--mu)">${isHoldingRow?'cost basis':'strike'}</span></td>
      <td class="mu">${r.size} ${r.asset}</td>
      <td class="mu">${coll}</td>
      <td class="${isHoldingRow?'mu':'cr'}">${isHoldingRow?'&mdash;': (r.outcome === 'CLOSED' ? '+$' + r.premium + '<br><span style="font-size:.6rem;color:var(--red)">-$' + fmt(r.closeCost || 0) + ' close</span>' : '+$'+r.premium)}</td>
      <td>${outcomeBadge}</td>
      <td>${aprStr}</td>
      <td>${lotPnlCell}</td>
      <td class="td-act"><div class="row-actions">${
        (r.outcome === 'OPEN' && r.type === 'CALL') ? `<button class="btn-qa btn-qa-exp" onclick="quickOutcome(${r.id},'EXPIRED')" title="Mark expired">Exp ✓</button><button class="btn-qa btn-qa-cal" onclick="quickOutcome(${r.id},'CALLED')" title="Mark called away">Called ↑</button>` :
        (r.outcome === 'OPEN' && r.type === 'PUT')  ? `<button class="btn-qa btn-qa-exp" onclick="quickOutcome(${r.id},'EXPIRED')" title="Mark expired">Exp ✓</button><button class="btn-qa btn-qa-asg" onclick="quickOutcome(${r.id},'ASSIGNED')" title="Mark assigned">Asgn ↓</button>` : ''
      }<button class="btn-d" onclick="deleteTrade(${r.id})" title="Delete">&#10005;</button></div></td>
    </tr>`;
  });

  tbody.innerHTML = html;
}
