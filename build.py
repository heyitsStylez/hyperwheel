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


def _git(args, cwd):
    try:
        result = subprocess.run(
            ['git', *args], cwd=cwd, capture_output=True, text=True,
        )
    except (FileNotFoundError, OSError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _ls_remote_targets():
    """Remotes to query for tags, in priority order.

    Vercel's ``origin`` points at an internal mirror that lags GitHub by a
    few seconds when a deploy hook fires immediately after a tag push, so
    prefer GitHub directly when env vars expose the repo slug.
    """
    targets = []
    owner = os.environ.get('VERCEL_GIT_REPO_OWNER')
    repo = os.environ.get('VERCEL_GIT_REPO_SLUG')
    if owner and repo:
        targets.append(f'https://github.com/{owner}/{repo}.git')
    targets.append('origin')
    return targets


def _tag_at_head_via_ls_remote(cwd):
    head = (
        os.environ.get('VERCEL_GIT_COMMIT_SHA')
        or _git(['rev-parse', 'HEAD'], cwd)
    )
    if not head:
        return None
    for target in _ls_remote_targets():
        refs = _git(['ls-remote', '--tags', target], cwd)
        if not refs:
            continue
        for line in refs.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[0] == head:
                name = parts[1].replace('refs/tags/', '').replace('^{}', '')
                if name:
                    return name
    return None


def resolve_version(cwd=BASE):
    """Return git-tag version string for the repo at *cwd*.

    Order of preference:
      1. Local exact-match tag at HEAD (``git describe --exact-match --tags``).
      2. Remote tag at HEAD via ``git ls-remote`` — preferring GitHub directly
         (via ``VERCEL_GIT_REPO_*`` env vars) over ``origin``, since Vercel's
         mirrored origin can lag immediately after a tag push.
      3. ``git describe --tags --always`` (describe-with-distance or short SHA).
      4. ``unknown`` if git is unavailable or *cwd* is not a repo.
    """
    tag = _git(['describe', '--exact-match', '--tags', 'HEAD'], cwd)
    if tag:
        return tag
    tag = _tag_at_head_via_ls_remote(cwd)
    if tag:
        return tag
    described = _git(['describe', '--tags', '--always'], cwd)
    return described or 'unknown'


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

    # Inject git-tag version. {{VERSION}} and {{VERSION_CLEAN}} are now
    # identical (we no longer surface the -dirty suffix); kept as separate
    # placeholders so existing template references still resolve.
    version = resolve_version()
    output = output.replace('{{VERSION_CLEAN}}', version)
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
