# Release labels

Auto-release runs on every push to `main` (`.github/workflows/release.yml`). The
workflow looks at the labels on the merged PR and decides what to do:

| Label           | Effect                                              |
|-----------------|-----------------------------------------------------|
| `release:skip`  | No tag, no release. Use for docs / infra-only PRs   |
| `release:major` | Major bump: `vX.Y.Z` → `vX+1.0.0`                   |
| `release:minor` | Minor bump: `vX.Y.Z` → `vX.Y+1.0`                   |
| _(none)_        | Patch bump: `vX.Y.Z` → `vX.Y.Z+1` (default)         |

**Precedence** when multiple are present: `skip` > `major` > `minor` > patch.

**First run** (no existing `vX.Y.Z` tags): treated as a base of `v1.0.0`, so a
default-labelled merge produces `v1.0.1`, `release:minor` produces `v1.1.0`, etc.

## Logic location

The pure version-bump function is `scripts/bump-version.js` (also runnable as a
CLI: `node scripts/bump-version.js <current-tag> <comma-separated-labels>`).
Tested in `test/unit/bump-version.test.js`. The workflow YAML just plumbs PR
labels and the latest tag into it.
