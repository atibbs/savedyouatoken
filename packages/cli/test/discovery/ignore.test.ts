import { describe, expect, it } from 'vitest';
import { isDirectoryIgnored, isIgnored } from '../../src/discovery/ignore';

describe('isIgnored', () => {
  it('matches a directory glob against files beneath it', () => {
    expect(isIgnored('node_modules/pkg/index.js', ['node_modules/**'])).toBe(true);
    expect(isIgnored('src/node_modules_like/index.js', ['node_modules/**'])).toBe(false);
  });

  it('matches a bare "name/**" ignore directory pattern at any depth, not just the scan root', () => {
    expect(isIgnored('packages/cli/node_modules/pkg/index.js', ['node_modules/**'])).toBe(true);
    expect(isIgnored('apps/web/.next/cache/x.json', ['.next/**'])).toBe(true);
    expect(isIgnored('a/b/c/dist/index.js', ['dist/**'])).toBe(true);
  });

  it('matches * within a single path segment only', () => {
    expect(isIgnored('a.log', ['*.log'])).toBe(true);
    expect(isIgnored('dir/a.log', ['*.log'])).toBe(false);
    expect(isIgnored('dir/a.log', ['**/*.log'])).toBe(true);
  });

  it('matches ** across zero or more directories', () => {
    expect(isIgnored('a.tmp', ['**/*.tmp'])).toBe(true);
    expect(isIgnored('x/y/z/a.tmp', ['**/*.tmp'])).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isIgnored('src/index.ts', ['node_modules/**', 'dist/**'])).toBe(false);
  });
});

describe('isDirectoryIgnored', () => {
  it('prunes a directory matched by a /** pattern, including the bare directory name', () => {
    expect(isDirectoryIgnored('node_modules', ['node_modules/**'])).toBe(true);
    expect(isDirectoryIgnored('node_modules', [])).toBe(false);
  });

  it('prunes a nested directory too, not only one sitting at the scan root', () => {
    // This is the monorepo case: node_modules lives under every package, not at the walk root.
    expect(isDirectoryIgnored('packages/cli/node_modules', ['node_modules/**'])).toBe(true);
    expect(isDirectoryIgnored('apps/web/.next', ['.next/**'])).toBe(true);
  });
});
