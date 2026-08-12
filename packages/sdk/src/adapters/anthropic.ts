import type { CapturedRequest, RequestAdapter } from '../types';

/** Read a value that may be a string or an array of `{ type: 'text', text }` blocks. */
function textFromSystem(system: unknown): string {
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') {
          return (block as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Anthropic Messages adapter. Duck-typed on the request shape
 * `{ model, system?, tools? }` and the response `{ usage: { output_tokens,
 * cache_read_input_tokens, input_tokens } }`. No `@anthropic-ai/sdk` import.
 */
export const anthropicAdapter: RequestAdapter = {
  provider: 'anthropic',
  extract(params, response) {
    if (!params || typeof params !== 'object') return null;
    const p = params as Record<string, unknown>;
    if (typeof p.model !== 'string' || !p.model) return null;

    const tools = Array.isArray(p.tools) && p.tools.length ? (p.tools as unknown[]) : undefined;

    const usage =
      response && typeof response === 'object'
        ? ((response as Record<string, unknown>).usage as Record<string, unknown> | undefined)
        : undefined;

    return {
      model: p.model,
      system: textFromSystem(p.system),
      tools,
      observedOutputTokens: num(usage?.output_tokens),
      observedCacheReadTokens: num(usage?.cache_read_input_tokens),
      observedInputTokens: num(usage?.input_tokens),
      timestamp: Date.now(),
    } satisfies CapturedRequest;
  },
};
