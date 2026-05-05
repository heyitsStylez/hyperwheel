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

    def test_dirty_tree(self):
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            git(d, 'tag', 'v1.2.3')
            open(os.path.join(d, 'a.txt'), 'w').write('changed')
            self.assertEqual(build.resolve_version(d), 'v1.2.3-dirty')

    def test_no_tags_returns_short_sha(self):
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            v = build.resolve_version(d)
            # short SHA: 7+ hex chars, not starting with 'v'
            self.assertRegex(v, r'^[0-9a-f]{7,}$')

    def test_dirty_only_in_artifacts_is_not_dirty(self):
        # Building rewrites hyperwheel.html / public/index.html. Those changes
        # alone must not flip the version to -dirty, otherwise every committed
        # artifact bakes in -dirty forever.
        with tempfile.TemporaryDirectory() as d:
            init_repo(d)
            os.makedirs(os.path.join(d, 'public'), exist_ok=True)
            with open(os.path.join(d, 'hyperwheel.html'), 'w') as f:
                f.write('<html></html>')
            with open(os.path.join(d, 'public', 'index.html'), 'w') as f:
                f.write('<html></html>')
            git(d, 'add', '.')
            git(d, 'commit', '-q', '-m', 'add artifacts')
            git(d, 'tag', '-a', 'v1.2.3', '-m', 'v1.2.3')
            with open(os.path.join(d, 'hyperwheel.html'), 'w') as f:
                f.write('<html>changed</html>')
            with open(os.path.join(d, 'public', 'index.html'), 'w') as f:
                f.write('<html>changed</html>')
            self.assertEqual(build.resolve_version(d), 'v1.2.3')

    def test_not_a_repo(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(build.resolve_version(d), 'unknown')


if __name__ == '__main__':
    unittest.main()
