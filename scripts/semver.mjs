// Minimal semver comparison and bumping for the CLI's plain x.y.z release versions (no
// prerelease tags). Shared by the pre-merge guard, the post-merge release gate, and the
// automatic version-bump workflow so they all agree on ordering.

export function parse(v) {
  const p = String(v).split('.').map((n) => Number.parseInt(n, 10));
  return [p[0] || 0, p[1] || 0, p[2] || 0];
}

/** True when a is strictly greater than b. */
export function gt(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return false;
}

/** Applies one semver bump. `type` is 'major' | 'minor' | 'patch'. */
export function bump(version, type) {
  const [major, minor, patch] = parse(version);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
