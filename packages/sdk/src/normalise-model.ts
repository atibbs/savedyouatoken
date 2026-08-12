import { getModel } from '@savedyouatoken/core';

export interface ModelResolution {
  /** The identifier exactly as the caller sent it. */
  raw: string;
  /** The catalogue model id, or `null` when the identifier cannot be mapped. */
  modelId: string | null;
}

/**
 * Explicit aliases for identifiers that do not reduce to a catalogue id by stripping a dated
 * suffix — chiefly older OpenAI snapshots whose base name is itself the catalogue id, plus a
 * few `-latest` conveniences. Kept small and hand-maintained; the general path below handles
 * the common `<model>-<date>` snapshot form without needing an entry here.
 */
const ALIASES: Record<string, string> = {
  'gpt-4o-2024-11-20': 'gpt-4o',
  'gpt-4o-2024-08-06': 'gpt-4o',
  'gpt-4o-2024-05-13': 'gpt-4o',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',
  'chatgpt-4o-latest': 'gpt-4o',
};

/** Remove a trailing dated snapshot suffix: `-20260514` or `-2026-05-14`, and `-latest`. */
function stripSnapshot(id: string): string {
  return id
    .replace(/-latest$/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-\d{8}$/, '');
}

/**
 * Provider identifiers spell versions with dots (`gpt-5.5`, `gpt-4.1`, `gemini-2.5-pro`) while
 * this repo's catalogue uses dashes (`gpt-5-5`, `gpt-4-1`, `gemini-2-5-pro`). Dashes are
 * unaffected, so this is safe to apply unconditionally as a lookup candidate.
 */
function dedot(id: string): string {
  return id.replace(/\./g, '-');
}

/** Resolve a single candidate string against the catalogue and the alias table. */
function lookup(id: string): string | null {
  if (getModel(id)) return id;
  return ALIASES[id] ?? null;
}

/**
 * Map a provider's model identifier — including dated/snapshot and dotted-version identifiers —
 * to a pricing-catalogue model id. Returns `{ modelId: null }` for anything unmappable so the
 * caller can surface the condition rather than silently dropping the audit.
 */
export function normaliseModelId(raw: string): ModelResolution {
  const stripped = stripSnapshot(raw);
  // Try, in order: verbatim, dot-normalised, snapshot-stripped, and both together.
  const candidates = [raw, dedot(raw), stripped, dedot(stripped)];
  for (const candidate of candidates) {
    const hit = lookup(candidate);
    if (hit) return { raw, modelId: hit };
  }
  return { raw, modelId: null };
}
