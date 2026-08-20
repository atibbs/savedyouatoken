import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { scan } from '../../src/discovery/scan';
import { DEFAULT_IGNORE, type AssetCandidate } from '../../src/discovery/types';

const fixtureRoot = fileURLToPath(new URL('../fixtures/discovery', import.meta.url));

function byId(candidates: AssetCandidate[], id: string): AssetCandidate | undefined {
  return candidates.find((c) => c.id === id);
}

describe('scan', () => {
  const { candidates } = scan({ roots: ['.'], ignore: DEFAULT_IGNORE }, fixtureRoot);

  it('includes a prompt-named .txt file and an agent-instructions file', () => {
    expect(byId(candidates, 'apps/a/prompts/system-prompt.txt')).toMatchObject({
      status: 'included',
      assetClass: 'prompt-text',
    });
    expect(byId(candidates, 'apps/b/AGENTS.md')).toMatchObject({
      status: 'included',
      assetClass: 'agent-instructions',
    });
  });

  it('includes a *.tools.json file and marks a plain JSON config unsupported', () => {
    expect(byId(candidates, 'tools/schema.tools.json')).toMatchObject({
      status: 'included',
      assetClass: 'tool-schema',
    });
    expect(byId(candidates, 'tools/config.json')).toMatchObject({ status: 'unsupported' });
  });

  it('marks a non-prompt-named .txt file ambiguous', () => {
    expect(byId(candidates, 'notes/notes.txt')).toMatchObject({ status: 'ambiguous' });
  });

  it('excludes a symlinked file and never follows it silently', () => {
    expect(byId(candidates, 'apps/b/linked-prompt.txt')).toMatchObject({
      status: 'excluded',
      reason: 'symlink',
    });
  });

  it('reports a binary file as excluded rather than silently skipping or classifying it', () => {
    expect(byId(candidates, 'apps/a/prompts/legacy-prompt.bin')).toMatchObject({
      status: 'excluded',
      reason: 'binary content',
    });
  });

  it('never lists anything under an ignored directory at the scan root', () => {
    expect(byId(candidates, 'node_modules/some-pkg/prompt.txt')).toBeUndefined();
  });

  it('prunes an ignored directory nested under a package too, not only at the scan root', () => {
    // This is the actual monorepo shape: node_modules lives under each package, never at the
    // walk root — a regression here previously slipped past a fixture that only covered the
    // root-level case.
    expect(byId(candidates, 'apps/a/node_modules/vendored-pkg/prompt.txt')).toBeUndefined();
  });

  it('produces stable, repository-relative, sorted ids', () => {
    const ids = candidates.map((c) => c.id);
    expect(ids.every((id) => !id.startsWith('/'))).toBe(true);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });
});

describe('scan root containment', () => {
  it('refuses a configured root that resolves outside the scan directory', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(() => scan({ roots: ['..'], ignore: DEFAULT_IGNORE }, fixtureRoot)).toThrow('process.exit(2)');
    expect(errSpy.mock.calls.join('\n')).toContain('resolves outside the scan directory');

    expect(() => scan({ roots: ['../../etc'], ignore: DEFAULT_IGNORE }, fixtureRoot)).toThrow('process.exit(2)');

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('still allows "." and nested subdirectories, which stay within the scan directory', () => {
    expect(() => scan({ roots: ['.'], ignore: DEFAULT_IGNORE }, fixtureRoot)).not.toThrow();
    expect(() => scan({ roots: ['apps/a'], ignore: DEFAULT_IGNORE }, fixtureRoot)).not.toThrow();
  });
});
