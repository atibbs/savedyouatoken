import { describe, expect, it } from 'vitest';
import { classifyFile } from '../../src/discovery/adapters';

describe('classifyFile', () => {
  it('recognises agent-instruction filenames', () => {
    expect(classifyFile('AGENTS.md', () => null)?.assetClass).toBe('agent-instructions');
    expect(classifyFile('apps/b/CLAUDE.md', () => null)?.assetClass).toBe('agent-instructions');
    expect(classifyFile('apps/b/CLAUDE.md', () => null)?.status).toBe('included');
  });

  it('recognises the *.tools.json convention without reading the file', () => {
    const result = classifyFile('tools/agent.tools.json', () => {
      throw new Error('should not read a file already recognised by name');
    });
    expect(result).toEqual({ status: 'included', assetClass: 'tool-schema', reason: expect.any(String) });
  });

  it('includes prompt-named .txt and .prompt files', () => {
    expect(classifyFile('support-prompt.txt', () => null)?.status).toBe('included');
    expect(classifyFile('a.prompt', () => null)?.status).toBe('included');
  });

  it('marks a plain .txt file with no "prompt" in its name as ambiguous', () => {
    const result = classifyFile('notes.txt', () => null);
    expect(result?.status).toBe('ambiguous');
  });

  it('sniffs generic .json for a tool-schema shape', () => {
    const toolsJson = JSON.stringify([{ name: 'lookup', description: 'x' }]);
    expect(classifyFile('a.json', () => toolsJson)?.status).toBe('included');
    expect(classifyFile('a.json', () => toolsJson)?.assetClass).toBe('tool-schema');
  });

  it('marks unrecognised JSON shapes and invalid JSON as unsupported', () => {
    expect(classifyFile('config.json', () => '{"foo":"bar"}')?.status).toBe('unsupported');
    expect(classifyFile('broken.json', () => '{not json')?.status).toBe('unsupported');
    // A plain object with no "tools"/"functions" array must stay unsupported even though core's
    // parseTools (used for a user-asserted --tools file) would lenient-accept it as one unnamed
    // tool — discovery classifies unknown files, so it must not follow that leniency.
    expect(classifyFile('package.json', () => '{"name":"my-pkg","version":"1.0.0"}')?.status).toBe('unsupported');
  });

  it('recognises the same wrapper shapes a real --tools file accepts', () => {
    const wrapped = JSON.stringify({ tools: [{ name: 'lookup', parameters: {} }] });
    const functionsWrapped = JSON.stringify({ functions: [{ name: 'lookup', description: 'x' }] });
    const openAiWrapped = JSON.stringify([{ type: 'function', function: { name: 'lookup', parameters: {} } }]);
    for (const json of [wrapped, functionsWrapped, openAiWrapped]) {
      const result = classifyFile('a.json', () => json);
      expect(result?.status).toBe('included');
      expect(result?.assetClass).toBe('tool-schema');
    }
  });

  it('returns null for files with no recognised name or extension at all', () => {
    expect(classifyFile('src/index.ts', () => 'anything')).toBeNull();
    expect(classifyFile('README.md', () => 'anything')).toBeNull();
  });
});
