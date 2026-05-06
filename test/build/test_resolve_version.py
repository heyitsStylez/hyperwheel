"""Tests for build.resolve_version().

Each test creates a fresh temporary git repo via subprocess so the result
does not depend on the host repo's tag state.
"""

import os
import sys
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

import build  # noqa: E402


def git(cwd, *args):
    env = os.environ.copy()
    env['GIT_AUTHOR_NAME'] = 'test'
    env['GIT_AUTHOR_EMAIL'] = 'test@example.com'
    env['GIT_COMMITTER_NAME'] = 'test'
    env['GIT_COMMITTER_EMAIL'] = 'test@example.com'
    subprocess.run(['git', *args], cwd=cwd, check=True, env=env,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def init_repo(path):
    git(path, 'init', '-q', '-b', 'main')
    git(path, 'config', 'commit.gpgsign', 'false')
    git(path, 'config', 'tag.gpgsign', 'false')
    git(path, 'config', 'tag.forceSignAnnotated', 'false')
    open(os.path.join(path, 'a.txt'), 'w').write('a')
    git(path, 'add', '.')
    git(path, 'commit', '-q', '-m', 'init')


class ResolveVersionTests(unittest.TestCase):

    def test_tag_at_head(self):
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            git(d, 'tag', 'v1.2.3')
            self.assertEqual(build.resolve_version(d), 'v1.2.3')

    def test_commits_past_tag(self):
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            git(d, 'tag', 'v1.2.3')
            open(os.path.join(d, 'b.txt'), 'w').write('b')
            git(d, 'add', '.')
            git(d, 'commit', '-q', '-m', 'second')
            v = build.resolve_version(d)
            self.assertTrue(v.startswith('v1.2.3-1-g'), f'got {v!r}')

    def test_dirty_tree_does_not_append_suffix(self):
        # We deliberately don't surface -dirty: Vercel checkouts can dirty
        # tracked files mid-build (e.g. npm install rewriting package-lock),
        # which has nothing to do with the source the user is looking at.
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            git(d, 'tag', 'v1.2.3')
            open(os.path.join(d, 'a.txt'), 'w').write('changed')
            self.assertEqual(build.resolve_version(d), 'v1.2.3')

    def test_no_tags_returns_short_sha(self):
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            v = build.resolve_version(d)
            # short SHA: 7+ hex chars, not starting with 'v'
            self.assertRegex(v, r'^[0-9a-f]{7,}$')

    def test_not_a_repo(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(build.resolve_version(d), 'unknown')

    def test_ls_remote_fallback_when_local_tag_refs_missing(self):
        # Vercel-like failure mode: HEAD is at a tagged commit on origin,
        # but local tag refs aren't populated (shallow clone quirks). The
        # ls-remote fallback should still surface the tag.
        with tempfile.TemporaryDirectory() as remote, \
             tempfile.TemporaryDirectory() as clone:
            init_repo(remote)
            git(remote, 'tag', 'v9.9.9')
            git(remote, 'config', 'receive.denyCurrentBranch', 'ignore')
            git(clone, 'clone', '--depth=1', remote, '.')
            # Strip local tag refs to simulate missing-tag-locally state
            for entry in os.listdir(os.path.join(clone, '.git', 'refs', 'tags')):
                os.remove(os.path.join(clone, '.git', 'refs', 'tags', entry))
            packed = os.path.join(clone, '.git', 'packed-refs')
            if os.path.exists(packed):
                with open(packed) as f:
                    lines = [l for l in f if 'refs/tags/' not in l]
                with open(packed, 'w') as f:
                    f.writelines(lines)
            self.assertIsNone(
                build._git(['describe', '--exact-match', '--tags', 'HEAD'], clone)
            )
            self.assertEqual(build.resolve_version(clone), 'v9.9.9')


    def test_ls_remote_targets_prefer_github_when_vercel_env_set(self):
        prev_owner = os.environ.get('VERCEL_GIT_REPO_OWNER')
        prev_repo = os.environ.get('VERCEL_GIT_REPO_SLUG')
        try:
            os.environ['VERCEL_GIT_REPO_OWNER'] = 'someone'
            os.environ['VERCEL_GIT_REPO_SLUG'] = 'thing'
            targets = build._ls_remote_targets()
            self.assertEqual(
                targets,
                ['https://github.com/someone/thing.git', 'origin'],
            )
        finally:
            for k, v in (
                ('VERCEL_GIT_REPO_OWNER', prev_owner),
                ('VERCEL_GIT_REPO_SLUG', prev_repo),
            ):
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_ls_remote_targets_origin_only_without_env(self):
        for k in ('VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG'):
            if k in os.environ:
                self.skipTest(f'{k} is set in this environment')
        self.assertEqual(build._ls_remote_targets(), ['origin'])


if __name__ == '__main__':
    unittest.main()
