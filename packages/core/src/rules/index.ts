import type { Rule } from '../types';
import {
  conversationalScaffolding,
  decorativeSeparators,
  excessWhitespace,
  politeness,
  promptFolklore,
  rolePreamble,
  shouting,
  tablePadding,
  typographicUnicode,
  wordyPhrases,
} from './text';
import {
  embeddedBlob,
  fewShotBloat,
  formatProse,
  negativePileup,
  prettyJson,
  redundantRepetition,
} from './structure';
import { cacheHostileOrder, cacheOpportunity, cacheTtlMismatch } from './cache';
import { bloatedToolSchemas, toolDefinitionOverhead } from './schema';
import {
  contextWindowPressure,
  longContextTier,
  outputDominatesBill,
  supersededModel,
  tokenizerFamilyShift,
} from './model';

/**
 * Order matters. When two rules want to edit the same span, the earlier rule wins, so
 * rules that replace whole regions (JSON blocks, duplicated lines) come before rules that
 * make word-level edits inside them.
 */
export const ALL_RULES: Rule[] = [
  // Region-level rewrites first.
  prettyJson,
  tablePadding,
  redundantRepetition,
  // Clause-level removals.
  rolePreamble,
  promptFolklore,
  conversationalScaffolding,
  politeness,
  wordyPhrases,
  // Character-level cleanups last.
  shouting,
  typographicUnicode,
  decorativeSeparators,
  excessWhitespace,
  // Advisory rules make no edits, so their order only affects tie-breaking in the UI.
  cacheOpportunity,
  cacheHostileOrder,
  cacheTtlMismatch,
  fewShotBloat,
  formatProse,
  embeddedBlob,
  negativePileup,
  toolDefinitionOverhead,
  bloatedToolSchemas,
  supersededModel,
  longContextTier,
  tokenizerFamilyShift,
  contextWindowPressure,
  outputDominatesBill,
];

export const RULES_BY_ID = new Map(ALL_RULES.map((r) => [r.id, r]));

export function getRule(id: string): Rule | undefined {
  return RULES_BY_ID.get(id);
}
