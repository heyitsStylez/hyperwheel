// Concatenates src/js/*.js in build order and evaluates it inside a jsdom window,
// mirroring how the browser loads the assembled <script> block.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', '..', 'src', 'js');

function loadApp(window, app = 'crypto') {
  // Load the platform-neutral core/ plus one app dir (crypto or tradfi); sort by
  // basename so the numeric prefixes drive load order regardless of directory
  // (mirrors build.py). Loading only one app dir avoids duplicate seam/boot defs.
  const files = ['core', app]
    .flatMap(d => fs.readdirSync(path.join(SRC_DIR, d))
      .filter(f => f.endsWith('.js'))
      .map(f => path.join(d, f)))
    .sort((a, b) => (path.basename(a) < path.basename(b) ? -1 : 1));
  const src = files.map(f => fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n');
  // Inject as a <script> element so we get classic-script semantics:
  // top-level `var` and `function` declarations become window properties,
  // matching how the assembled hyperwheel.html actually loads.
  const script = window.document.createElement('script');
  script.textContent = src;
  window.document.body.appendChild(script);
}

module.exports = { loadApp };
