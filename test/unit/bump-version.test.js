const test = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion } = require('../../scripts/bump-version.js');

test('release:skip → skip', () => {
  assert.equal(nextVersion('v1.2.3', ['release:skip']), 'skip');
});

test('no bump label → patch bump', () => {
  assert.equal(nextVersion('v1.2.3', []), 'v1.2.4');
});

test('unrelated labels → patch bump', () => {
  assert.equal(nextVersion('v0.0.0', ['bug', 'docs']), 'v0.0.1');
});

test('release:minor → minor bump, patch reset', () => {
  assert.equal(nextVersion('v1.2.3', ['release:minor']), 'v1.3.0');
});

test('release:major → major bump, minor + patch reset', () => {
  assert.equal(nextVersion('v1.2.3', ['release:major']), 'v2.0.0');
});

test('precedence: skip beats major', () => {
  assert.equal(nextVersion('v1.2.3', ['release:major', 'release:skip']), 'skip');
});

test('precedence: major beats minor', () => {
  assert.equal(nextVersion('v1.2.3', ['release:minor', 'release:major']), 'v2.0.0');
});

test('precedence: minor beats patch (default)', () => {
  assert.equal(nextVersion('v1.2.3', ['release:minor', 'bug']), 'v1.3.0');
});

test('no existing tag (empty) → seed at v1.0.0, patch bump → v1.0.1', () => {
  assert.equal(nextVersion('', []), 'v1.0.1');
});

test('no existing tag (null) → v1.0.1 on default bump', () => {
  assert.equal(nextVersion(null, []), 'v1.0.1');
});

test('no existing tag + release:minor → v1.1.0', () => {
  assert.equal(nextVersion('', ['release:minor']), 'v1.1.0');
});

test('no existing tag + release:skip → skip', () => {
  assert.equal(nextVersion('', ['release:skip']), 'skip');
});
