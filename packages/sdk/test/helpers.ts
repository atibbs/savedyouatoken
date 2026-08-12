import { createCounterFromO200k, type TokenCounter, type Workload } from '@savedyouatoken/core';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

import type { AuditEvent } from '../src/types';
import { callbackSink } from '../src/sinks';

/** The same real o200k_base counter the SDK, web app and CLI use — so parity is exact. */
export function testCounter(): TokenCounter {
  return createCounterFromO200k((text) => encode(text), 'o200k_base');
}

/** A fully-specified workload, so a measured workload equals it and parity is deterministic. */
export const FIXED_WORKLOAD: Workload = {
  requestsPerDay: 20000,
  outputTokens: 400,
  cacheHitRate: 0,
  cacheTtl: '5m',
  batch: false,
};

/** Collect every emitted event, for assertions. */
export function collectingSink(): { events: AuditEvent[]; sink: ReturnType<typeof callbackSink> } {
  const events: AuditEvent[] = [];
  return { events, sink: callbackSink((e) => events.push(e)) };
}

/** A representative Anthropic request with a system prompt and one tool. */
export function anthropicRequest(overrides: Record<string, unknown> = {}) {
  return {
    model: 'claude-sonnet-5',
    system:
      'You are a helpful assistant. Please, please be extremely thorough and very very detailed in every single response you produce.',
    tools: [
      {
        name: 'search_knowledge_base',
        description: 'Search the internal knowledge base for relevant documents and passages.',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'The search query' } },
          required: ['query'],
        },
      },
    ],
    messages: [{ role: 'user', content: 'hi' }],
    ...overrides,
  };
}

export function anthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    usage: { input_tokens: 900, output_tokens: 350, cache_read_input_tokens: 0, ...overrides },
  };
}

/** Let scheduled macrotasks (deferred observations) run to completion. */
export function flushMacrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
