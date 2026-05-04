# Label-driven auto-release on merge to main

Every merge to `main` triggers a GitHub Action that bumps the latest git tag,
creates a GitHub Release with auto-generated notes, and pushes the new tag.
The bump level is read from PR labels: `release:major` → major, `release:minor`
→ minor, otherwise patch. A `release:skip` label is the escape hatch — no tag
is created, useful for doc-only or infra-only changes.

`build.py` injects the result of `git describe --tags --always --dirty` into a
`{{VERSION}}` placeholder, so the footer (and wallet popup) always reflect the
deployed tag without any manual edit.

## Why this over the alternatives

- **Manual tagging / local script** — relies on remembering to run it. The
  whole point of automating was to remove that.
- **`workflow_dispatch` button** — still manual, just relocated. Good fallback
  but doesn't solve "I forgot."
- **`release-please` / `semantic-release`** — heavier, requires conventional-
  commit discipline, adds a dep. Overkill for a single-dev single-file app.

## Consequences

- Tag noise: tags accumulate fast (one per merge). Acceptable — tags are cheap
  and the footer's job is "what am I running," not "what was the last
  milestone."
- The `release:skip` label must be remembered for non-shipping merges,
  otherwise patch tags get cut for doc tweaks. Low harm if forgotten.
