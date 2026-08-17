/**
 * A small, dependency-free ignore-pattern matcher. It supports the handful of glob shapes
 * discovery configs actually need — `dir/**`, `*.ext`, `**​/name` — not the full glob grammar a
 * library like `fast-glob` or `minimatch` would give you. That is a deliberate trade: repository
 * scanning must stay a zero-dependency, auditable code path, and these patterns cover every
 * fixture and every real ignore rule this feature needs (see `discovery/scan.test.ts`).
 */

export function isIgnored(relPath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegex(pattern).test(relPath));
}

/** Whether a directory should be pruned from the walk before recursing into it. Directory
 *  patterns are usually written as `name/**`; this also matches a bare `name` pattern. */
export function isDirectoryIgnored(relPath: string, patterns: string[]): boolean {
  return isIgnored(relPath, patterns) || isIgnored(`${relPath}/.`, patterns);
}

const cache = new Map<string, RegExp>();

// A bare "name/**" pattern (no wildcard in the segment itself) — every DEFAULT_IGNORE entry is
// exactly this shape — means "this directory, wherever it appears", matching how a real
// .gitignore treats an unrooted entry. Without this, `node_modules/**` only matched a
// node_modules directory sitting at the scan root, never one nested inside a package (which is
// where it actually lives in a monorepo like this one).
const NAME_PATTERN = /^[^/*]+\/\*\*$/;

function globToRegex(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  let normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
  if (NAME_PATTERN.test(normalized)) normalized = `**/${normalized}`;
  let body = '';
  let i = 0;
  while (i < normalized.length) {
    if (normalized[i] === '*' && normalized[i + 1] === '*') {
      body += '.*';
      i += 2;
      if (normalized[i] === '/') i++; // `**/x` also matches `x` with zero intervening directories
      continue;
    }
    const ch = normalized[i]!;
    if (ch === '*') body += '[^/]*';
    else if (ch === '?') body += '[^/]';
    else body += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i++;
  }

  const regex = new RegExp(`^${body}$`);
  cache.set(pattern, regex);
  return regex;
}
