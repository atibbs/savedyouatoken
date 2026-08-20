/**
 * Token counting.
 *
 * Honesty policy: only OpenAI publishes the tokenizer we can run exactly (o200k_base, via
 * the `gpt-tokenizer` package the web app and CLI inject). Anthropic and Google do not ship
 * a public offline tokenizer, so their counts here are *estimates* derived from the o200k
 * count and a documented family factor. Every surface that shows a number must also show
 * whether it is exact or estimated — see `Accuracy`.
 *
 * The core package deliberately has no dependencies, so it ships a dependency-free
 * heuristic counter as a fallback and for tests. Callers inject a real BPE counter.
 */

import type { TokenizerFamily } from './models';

export type Accuracy = 'exact' | 'estimated';

export interface TokenCounter {
  /** Count tokens in `text` for the given tokenizer family. */
  count(text: string, family: TokenizerFamily): number;
  /** Whether the result for this family is exact or an estimate. */
  accuracy(family: TokenizerFamily): Accuracy;
  /** Human-readable name, shown in the UI so people know what produced the number. */
  readonly name: string;
}

/**
 * Multipliers applied to an o200k_base count to estimate other families.
 *
 * - `claude-legacy`: treated as comparable to o200k for English text. This is an
 *   assumption, not a published figure.
 * - `claude-next`: Anthropic documents that the tokenizer introduced with Claude 4.7
 *   "produces approximately 30% more tokens for the same text" than the previous Claude
 *   tokenizer. That 1.30 is the only hard number here, and it is relative to claude-legacy.
 * - `gemini`: treated as comparable to o200k for English text. Also an assumption.
 */
export const FAMILY_FACTOR: Record<TokenizerFamily, number> = {
  o200k: 1,
  'claude-legacy': 1,
  'claude-next': 1.3,
  gemini: 1,
};

export const FAMILY_LABELS: Record<TokenizerFamily, string> = {
  o200k: 'o200k_base (OpenAI)',
  'claude-legacy': 'Claude (Sonnet 4.6 and earlier)',
  'claude-next': 'Claude (Opus 4.7 and later)',
  gemini: 'Gemini',
};

/**
 * Dependency-free approximation of byte-pair encoding.
 *
 * Runs in a single pass over character classes. It is deliberately conservative and
 * documented as ±15% on prose, worse on dense code. Real analyses in the browser and CLI
 * use a genuine BPE tokenizer; this exists so the core package stays dependency-free and
 * so unit tests do not need a 2 MB vocabulary file.
 */
export function heuristicO200kCount(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i]!;

    if (ch === '\n' || ch === '\r') {
      // Newline runs collapse: "\n\n" is commonly one token, longer runs roughly halve.
      let j = i;
      while (j < n && (text[j] === '\n' || text[j] === '\r')) j++;
      const run = j - i;
      tokens += run <= 2 ? 1 : Math.ceil(run / 2);
      i = j;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      let j = i;
      while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
      const run = j - i;
      // A single space attaches to the following word for free. Indentation costs.
      tokens += run <= 1 ? 0 : Math.ceil((run - 1) / 4);
      i = j;
      continue;
    }

    if (isLetter(ch)) {
      let j = i;
      while (j < n && isLetter(text[j]!)) j++;
      const len = j - i;
      // Common short words are one token; longer words split roughly every 4-5 chars.
      tokens += len <= 5 ? 1 : Math.ceil(len / 4.5);
      i = j;
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < n && text[j]! >= '0' && text[j]! <= '9') j++;
      // Digits group in ones-to-threes depending on the vocabulary; three is a fair mean.
      tokens += Math.ceil((j - i) / 3);
      i = j;
      continue;
    }

    // Punctuation and symbols. Repeated identical symbols merge ("====" is cheap).
    let j = i;
    while (j < n && text[j] === ch) j++;
    const run = j - i;
    tokens += run <= 1 ? 1 : Math.ceil(run / 4);
    i = j;

    // Non-ASCII characters routinely cost multiple tokens each.
    if (ch.charCodeAt(0) > 127) tokens += run;
  }

  return tokens;
}

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

/** The fallback counter: heuristic o200k count, scaled by family factor. */
export const heuristicCounter: TokenCounter = {
  name: 'heuristic (±15%)',
  count(text, family) {
    return Math.round(heuristicO200kCount(text) * FAMILY_FACTOR[family]);
  },
  accuracy() {
    return 'estimated';
  },
};

/**
 * Build a TokenCounter from a real o200k_base encoder (e.g. `gpt-tokenizer`).
 * Exact for OpenAI models, estimated elsewhere via the family factor.
 */
export function createCounterFromO200k(
  encode: (text: string) => number[] | Uint32Array,
  name = 'o200k_base',
): TokenCounter {
  return {
    name,
    count(text, family) {
      if (!text) return 0;
      const base = encode(text).length;
      const factor = FAMILY_FACTOR[family];
      return factor === 1 ? base : Math.round(base * factor);
    },
    accuracy(family) {
      return family === 'o200k' ? 'exact' : 'estimated';
    },
  };
}
