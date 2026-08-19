// ═══════════════════════════════════════════════════════════
// HEADER CLOCK — UTC on HyperWheel, US market time (ET) on Wheeler
// ═══════════════════════════════════════════════════════════
(function() {
  const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  // Wheeler trades US-listed equities/ETFs, so its clock tracks New York.
  // Intl handles the EST↔EDT (UTC−5 ↔ UTC−4) DST switch automatically.
  const isTradfi = document.body.dataset.app === 'tradfi';
  const etFmt = isTradfi ? new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  }) : null;
  function tickUtc(now) {
    const hh = String(now.getUTCHours()).padStart(2,'0');
    const mm = String(now.getUTCMinutes()).padStart(2,'0');
    const ss = String(now.getUTCSeconds()).padStart(2,'0');
    const day = DAYS[now.getUTCDay()];
    const date = String(now.getUTCDate()).padStart(2,'0');
    const month = MONTHS[now.getUTCMonth()];
    document.getElementById('utc-time').textContent = hh+':'+mm+':'+ss;
    document.getElementById('utc-date').textContent = day+' '+date+' '+month+' · UTC';
  }
  function tickEt(now) {
    const p = {};
    for (const part of etFmt.formatToParts(now)) p[part.type] = part.value;
    document.getElementById('utc-time').textContent = `${p.hour}:${p.minute}:${p.second}`;
    document.getElementById('utc-date').textContent =
      `${p.weekday.toUpperCase()} ${p.day} ${p.month.toUpperCase()} · ${p.timeZoneName}`;
  }
  function tickClock() {
    const now = new Date();
    if (isTradfi) tickEt(now); else tickUtc(now);
  }
  tickClock();
  setInterval(tickClock, 1000);
})();
