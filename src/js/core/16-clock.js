// ═══════════════════════════════════════════════════════════
// UTC CLOCK
// ═══════════════════════════════════════════════════════════
(function() {
  const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function tickClock() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2,'0');
    const mm = String(now.getUTCMinutes()).padStart(2,'0');
    const ss = String(now.getUTCSeconds()).padStart(2,'0');
    const day = DAYS[now.getUTCDay()];
    const date = String(now.getUTCDate()).padStart(2,'0');
    const month = MONTHS[now.getUTCMonth()];
    document.getElementById('utc-time').textContent = hh+':'+mm+':'+ss;
    document.getElementById('utc-date').textContent = day+' '+date+' '+month+' · UTC';
  }
  tickClock();
  setInterval(tickClock, 1000);
})();
