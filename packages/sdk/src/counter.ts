import { createCounterFromO200k, type TokenCounter } from '@savedyouatoken/core';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

/**
 * The SDK's default token counter: a real o200k_base BPE encoder, exactly the one the web app
 * and CLI inject. Exact for OpenAI models, estimated for others via the family factor in core.
 * Injecting it here keeps `@savedyouatoken/core` dependency-free while the SDK owns the one
 * runtime dependency.
 */
export function createDefaultCounter(): TokenCounter {
  return createCounterFromO200k((text) => encode(text), 'o200k_base');
}
