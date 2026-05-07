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

1. **Fork** this repo and clone your fork.
2. **Branch** off `main` (`git checkout -b my-change`).
3. Make your edits under `src/`, run the build and tests (see above).
4. **Push** your branch to your fork and open a PR against
   `heyitsStylez/hyperwheel:main`.

Then:

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

## Pre-commit hook

Husky is installed as a dev dependency. After `npm install`, the `prepare`
script wires up `.husky/pre-commit`, which runs:

```bash
npm run build   # python3 build.py --check
npm test        # unit + jsdom integration tests
```

This gates every commit on the same checks CI runs. There is no Prettier or
typecheck step — the codebase is plain JS with no TypeScript, and formatting
is enforced by convention rather than tooling. If a commit needs to bypass
the hook (rare — e.g. a WIP stash), use `git commit --no-verify`, but don't
push past CI that way.

## Release labels (maintainers)

PRs can carry one of these labels to control the auto-release version bump:

- `release:major` — major bump (X.0.0)
- `release:minor` — minor bump (x.Y.0)
- `release:skip` — no tag, no release (use for doc-only or infra-only changes)
- (no label) — patch bump (x.y.Z)

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
