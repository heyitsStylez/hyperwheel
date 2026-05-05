#!/usr/bin/env python3
"""
HyperWheel build script.
Assembles hyperwheel.html from modular source files:

  src/html/head.html    — <head> with /* CSS_PLACEHOLDER */ marker
  src/css/styles.css    — all CSS (injected in place of placeholder)
  src/html/body.html    — <body> content (header, main, trade drawer)
  src/js/01-*.js        — JS modules concatenated in numeric order
  src/html/modals.html  — overlay modals appended after <script> block

Outputs:
  hyperwheel.html       — local dev copy
  public/index.html     — Vercel deployment artifact

Usage:
  python3 build.py             # build only
  python3 build.py --check     # build + JS syntax check
"""

import sys
import subprocess
import os
import glob

BASE = os.path.dirname(os.path.abspath(__file__))


def read(path):
    with open(path) as f:
        return f.read()


def resolve_version(cwd=BASE):
    """Return git-tag version string for the repo at *cwd*.

    Order of preference:
      1. ``git describe --tags --always --dirty`` (tag, or short SHA if no tag).
      2. ``unknown`` if git is unavailable or *cwd* is not a repo.
    """
    try:
        result = subprocess.run(
            ['git', 'describe', '--tags', '--always', '--dirty'],
            cwd=cwd, capture_output=True, text=True,
        )
    except (FileNotFoundError, OSError):
        return 'unknown'
    if result.returncode != 0:
        return 'unknown'
    return result.stdout.strip() or 'unknown'


def build():
    css      = read(os.path.join(BASE, 'src', 'css', 'styles.css'))
    head_tmpl = read(os.path.join(BASE, 'src', 'html', 'head.html'))
    body_html = read(os.path.join(BASE, 'src', 'html', 'body.html'))
    modals_html = read(os.path.join(BASE, 'src', 'html', 'modals.html'))

    # Concatenate JS modules in numeric order
    js_files = sorted(glob.glob(os.path.join(BASE, 'src', 'js', '*.js')))
    if not js_files:
        raise RuntimeError("No JS files found in src/js/")
    js = '\n'.join(read(f) for f in js_files)

    # Inject CSS
    if '/* CSS_PLACEHOLDER */' not in head_tmpl:
        raise RuntimeError("head.html is missing /* CSS_PLACEHOLDER */ marker")
    head = head_tmpl.replace('/* CSS_PLACEHOLDER */', css.rstrip('\n'))

    output = (
        head
        + '<body>\n'
        + body_html
        + '<script>\n'
        + js
        + '\n</script>\n'
        + '\n'
        + modals_html
        + '</body>\n'
        + '</html>\n'
    )

    # Inject git-tag version. {{VERSION}} keeps the -dirty suffix for display;
    # {{VERSION_CLEAN}} strips it so release links resolve to a real tag.
    version = resolve_version()
    version_clean = version[:-len('-dirty')] if version.endswith('-dirty') else version
    output = output.replace('{{VERSION_CLEAN}}', version_clean)
    output = output.replace('{{VERSION}}', version)

    # Write local copy
    local_path = os.path.join(BASE, 'hyperwheel.html')
    with open(local_path, 'w') as f:
        f.write(output)
    print(f"Built {local_path} ({len(output.splitlines())} lines, {len(js_files)} JS modules)")

    # Write Vercel output
    public_dir = os.path.join(BASE, 'public')
    os.makedirs(public_dir, exist_ok=True)
    public_path = os.path.join(public_dir, 'index.html')
    with open(public_path, 'w') as f:
        f.write(output)
    print(f"Wrote  {public_path}")

    return output, js


def syntax_check(js):
    tmp = '/tmp/hyperwheel_check.js'
    with open(tmp, 'w') as f:
        f.write(js)
    result = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if result.returncode == 0:
        print("JS syntax check: OK")
    else:
        print("JS syntax check: FAILED")
        print(result.stderr)
        sys.exit(1)


if __name__ == '__main__':
    output, js = build()
    if '--check' in sys.argv:
        syntax_check(js)
