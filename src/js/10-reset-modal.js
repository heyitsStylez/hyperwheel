function showReset()  { document.getElementById('rovl').classList.add('open'); }
function closeReset() { document.getElementById('rovl').classList.remove('open'); }
function doReset()    { trades = []; save(); render(); closeReset(); }
document.getElementById('rovl').addEventListener('click', function(e) { if(e.target===this) closeReset(); });
