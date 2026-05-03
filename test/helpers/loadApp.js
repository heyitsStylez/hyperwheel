// Concatenates src/js/*.js in build order and evaluates it inside a jsdom window,
// mirroring how the browser loads the assembled <script> block.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', '..', 'src', 'js');

function loadApp(window) {
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js')).sort();
  const src = files.map(f => fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n');
  // Inject as a <script> element so we get classic-script semantics:
  // top-level `var` and `function` declarations become window properties,
  // matching how the assembled hyperwheel.html actually loads.
  const script = window.document.createElement('script');
  script.textContent = src;
  window.document.body.appendChild(script);
}

module.exports = { loadApp };
