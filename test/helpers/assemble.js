// Assembles the app body HTML the same way build.py does, so jsdom tests see
// the real DOM (fragments substituted) rather than raw {{FRAG:...}} markers.
// The fragment list + app title/subtitle come from src/app-manifest.json, the
// same single source of truth build.py reads — no more keep-in-sync drift (#98).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'app-manifest.json'), 'utf8'));
const FRAGMENTS = MANIFEST.fragments;
const APP_META = Object.fromEntries(
  Object.entries(MANIFEST.apps).map(([app, cfg]) => [app, { title: cfg.title, subtitle: cfg.subtitle }]),
);

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
