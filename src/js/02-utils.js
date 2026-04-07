function today() { return new Date().toISOString().split('T')[0]; }
function save()  { localStorage.setItem(KEY, JSON.stringify(trades)); scheduleAutoSync(); }
function fmt(n)  { return Number(n).toLocaleString('en', {maximumFractionDigits: 2, minimumFractionDigits: 0}); }
function sk(v)   { return Math.abs(v) >= 1000 ? (v/1000).toFixed(1).replace(/\.0$/,'')+'K' : fmt(v); }
