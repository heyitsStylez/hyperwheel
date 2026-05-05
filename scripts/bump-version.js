function nextVersion(currentTag, labels) {
  if (labels.includes('release:skip')) return 'skip';
  const m = currentTag ? /^v(\d+)\.(\d+)\.(\d+)$/.exec(currentTag) : null;
  const [major, minor, patch] = m ? [+m[1], +m[2], +m[3]] : [1, 0, 0];
  if (labels.includes('release:major')) return `v${major + 1}.0.0`;
  if (labels.includes('release:minor')) return `v${major}.${minor + 1}.0`;
  return `v${major}.${minor}.${patch + 1}`;
}

module.exports = { nextVersion };

if (require.main === module) {
  const [currentTag, labelsCsv] = process.argv.slice(2);
  const labels = labelsCsv ? labelsCsv.split(',').map(s => s.trim()).filter(Boolean) : [];
  process.stdout.write(nextVersion(currentTag || '', labels));
}
