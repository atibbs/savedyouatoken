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
 * Map a provider's model identifier — including dated/snapshot identifiers — to a
 * pricing-catalogue model id. Returns `{ modelId: null }` for anything unmappable so the
 * caller can surface the condition rather than silently dropping the audit.
 */
export function normaliseModelId(raw: string): ModelResolution {
  if (getModel(raw)) return { raw, modelId: raw };

  const alias = ALIASES[raw];
  if (alias) return { raw, modelId: alias };

  const stripped = stripSnapshot(raw);
  if (stripped !== raw) {
    if (getModel(stripped)) return { raw, modelId: stripped };
    if (ALIASES[stripped]) return { raw, modelId: ALIASES[stripped]! };
  }

  return { raw, modelId: null };
}
