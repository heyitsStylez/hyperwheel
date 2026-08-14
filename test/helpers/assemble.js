// Assembles the app body HTML the same way build.py does, so jsdom tests see
// the real DOM (fragments substituted) rather than raw {{FRAG:...}} markers.
// Mirrors build.py's FRAGMENTS list + APPS title/subtitle — keep in sync.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FRAGMENTS = ['wallet_overlay', 'header_actions', 'filter_tabs', 'trade_form', 'footer'];
const APP_META = {
  crypto: { title: 'HyperWheel', subtitle: 'WHEEL STRATEGY TRACKER' },
  tradfi: { title: 'Wheeler', subtitle: 'TRADFI WHEEL TRACKER' },
};

function assembleBody(app = 'crypto') {
  let body = fs.readFileSync(path.join(ROOT, 'src', 'html', 'body.html'), 'utf8');
  const dir = path.join(ROOT, 'src', 'html', app);
  for (const name of FRAGMENTS) {
    const marker = '{{FRAG:' + name + '}}';
    if (!body.includes(marker)) continue;
    const frag = fs.readFileSync(path.join(dir, name + '.html'), 'utf8').replace(/\n+$/, '');
    body = body.split(marker).join(frag);
  }
  const meta = APP_META[app];
  return body
    .split('{{APP_TITLE}}').join(meta.title)
    .split('{{APP_SUBTITLE}}').join(meta.subtitle)
    .split('{{VERSION_CLEAN}}').join('test')
    .split('{{VERSION}}').join('test');
}

module.exports = { assembleBody, APP_META };
