# Contributing

Thanks for your interest. HyperWheel is a small single-file project, so the
workflow is simple.

## Source layout

- **Edit only `src/`** — the modular sources under `src/css/`, `src/html/`,
  and `src/js/`.
- **Never edit `hyperwheel.html` or `public/index.html` directly** — they
  are built artifacts.

## Build

After any change under `src/`:

```bash
python3 build.py --check
```

That assembles the modules into `hyperwheel.html` + `public/index.html` and
runs a Node syntax check on the output. PRs that don't build will not be
merged.

## Pull requests

- Keep changes focused — one feature or fix per PR.
- Match the existing style; this codebase deliberately avoids bundlers,
  frameworks, and dependencies beyond Chart.js (CDN).
- If you add a user-visible feature, update the relevant section of
  `README.md` and `CLAUDE.md`.
- Open an issue first for anything larger than a small fix so we can agree
  on the approach before you build it.

## Testing

The project ships zero runtime dependencies, but tests use `jsdom` as a
dev-only dependency.

```bash
npm install     # one-time, installs jsdom
npm test        # runs unit + jsdom integration tests
```

Tests live under `test/`:

- `test/unit/*.test.js` — pure-logic tests (lot engine, compute, merge, fmt)
- `test/integration/*.test.js` — jsdom tests that boot the full app
- `test/helpers/{loadApp,setupJsdom}.js` — shared harness

CI runs `npm test` on every push and PR via `.github/workflows/test.yml`.

Modules that need to be `require()`-able from Node (e.g. `04b-lot-engine.js`)
use a guarded dual-export footer:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lotEngine };
}
```

The guard is a no-op in the browser (`module` is undefined there), so the
single-file build is unaffected.

In addition, manually verify:

1. The page loads with no console errors.
2. Trade entry, edit, delete, and merge flows still work.
3. Charts render with both empty and populated data.
4. If you touched chain-sync, deploy a preview and try a real wallet.
