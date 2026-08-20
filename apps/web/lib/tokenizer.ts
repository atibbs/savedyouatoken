import { createCounterFromO200k, heuristicCounter, type TokenCounter } from '@savedyouatoken/core';

let cached: TokenCounter | null = null;
let inFlight: Promise<TokenCounter> | null = null;

/** The counter available right now — the heuristic until the real BPE tables arrive. */
export function currentCounter(): TokenCounter {
  return cached ?? heuristicCounter;
}

export function isExactCounterLoaded(): boolean {
  return cached !== null;
}

/**
 * Load the real o200k_base tables. They are a megabyte or so, so this happens lazily on
 * first use rather than in the initial bundle; until it resolves the page still works, on
 * the heuristic, and simply says so.
 */
export function loadExactCounter(): Promise<TokenCounter> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = import('gpt-tokenizer/encoding/o200k_base')
    .then((mod) => {
      cached = createCounterFromO200k((text) => mod.encode(text), 'o200k_base');
      return cached;
    })
    .catch(() => heuristicCounter);

  return inFlight;
}
