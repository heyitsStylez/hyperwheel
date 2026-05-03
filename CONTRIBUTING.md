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

There is no automated test suite yet. Manually verify:

1. The page loads with no console errors.
2. Trade entry, edit, delete, and merge flows still work.
3. Charts render with both empty and populated data.
4. If you touched chain-sync, deploy a preview and try a real wallet.
