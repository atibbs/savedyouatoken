import { basename, extname } from 'node:path';
import type { AssetClass, AssetStatus } from './types';

export interface Classification {
  status: AssetStatus;
  assetClass?: AssetClass;
  reason: string;
}

const AGENT_INSTRUCTION_NAMES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'SYSTEM.md',
  'GEMINI.md',
  '.cursorrules',
  '.windsurfrules',
]);

/**
 * Classifies one file by name/extension/structure only — never by grepping its text for
 * "prompt-shaped" content. Files with no recognised name or extension return `null` and never
 * become a candidate at all, which is what keeps this "discovery" rather than "audit every file
 * in the repository": see design.md's rejection of treating every string literal as a prompt.
 */
export function classifyFile(relPath: string, readText: () => string | null): Classification | null {
  const name = basename(relPath);

  if (AGENT_INSTRUCTION_NAMES.has(name)) {
    return {
      status: 'included',
      assetClass: 'agent-instructions',
      reason: `recognised agent-instructions filename (${name})`,
    };
  }

  if (name.toLowerCase().endsWith('.tools.json')) {
    return {
      status: 'included',
      assetClass: 'tool-schema',
      reason: 'filename matches the *.tools.json convention',
    };
  }

  const ext = extname(name).toLowerCase();

  if (ext === '.json') return classifyJson(readText);

  if (ext === '.prompt') {
    return { status: 'included', assetClass: 'prompt-text', reason: 'recognised .prompt extension' };
  }

  if (ext === '.txt') {
    if (/prompt/i.test(name)) {
      return { status: 'included', assetClass: 'prompt-text', reason: 'filename contains "prompt"' };
    }
    return {
      status: 'ambiguous',
      reason: 'a .txt file with no "prompt" in its name is not audited automatically; rename it or list it explicitly',
    };
  }

  return null;
}

function classifyJson(readText: () => string | null): Classification {
  const text = readText();
  if (text == null) return { status: 'unsupported', reason: 'could not read the file to inspect its shape' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'unsupported', reason: 'not valid JSON' };
  }
  if (looksLikeToolSchema(parsed)) {
    return { status: 'included', assetClass: 'tool-schema', reason: 'JSON array of tool/function definitions' };
  }
  return { status: 'unsupported', reason: 'JSON file does not match a recognised tool-schema shape' };
}

/**
 * Recognises the same wrapper shapes `packages/core/src/segment.ts`'s `parseTools` accepts for a
 * real `--tools <file>` audit — a bare array, `{ tools: [...] }`, `{ functions: [...] }`, and
 * OpenAI's `{ type: 'function', function: {...} }` per-item wrapper — so discovery does not
 * disagree with what the analyzer itself would treat as a tools file. It deliberately does NOT
 * reuse `parseTools` itself: that function is intentionally lenient for a user-asserted `--tools`
 * file (it accepts any single JSON object, falling back to the name "(unnamed)"), which is right
 * for that use case but would make discovery classify nearly any JSON file as a tool schema.
 * Discovery instead requires every item to carry a genuine `name` plus a shape field.
 */
function looksLikeToolSchema(value: unknown): boolean {
  const list = toCandidateList(value);
  if (!list || list.length === 0) return false;
  return list.every((item) => {
    if (item == null || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    const inner =
      obj.function != null && typeof obj.function === 'object' ? (obj.function as Record<string, unknown>) : obj;
    return typeof inner.name === 'string' && ('description' in inner || 'parameters' in inner || 'input_schema' in inner);
  });
}

function toCandidateList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value == null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.tools)) return obj.tools;
  if (Array.isArray(obj.functions)) return obj.functions;
  return null;
}
