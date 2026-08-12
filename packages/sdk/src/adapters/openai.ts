import type { CapturedRequest, RequestAdapter } from '../types';

/** Text of one message's `content`, which may be a string or an array of content parts. */
function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
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
 * Collect the system/developer prompt from a Chat Completions `messages` array and/or a
 * Responses API `instructions` string. Both request styles are supported.
 */
function systemText(p: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof p.instructions === 'string' && p.instructions) parts.push(p.instructions);
  if (Array.isArray(p.messages)) {
    for (const message of p.messages) {
      if (!message || typeof message !== 'object') continue;
      const role = (message as { role?: unknown }).role;
      if (role === 'system' || role === 'developer') {
        parts.push(textFromContent((message as { content?: unknown }).content));
      }
    }
  }
  return parts.filter(Boolean).join('\n');
}

/**
 * OpenAI adapter, covering both Chat Completions (`messages`, `usage.completion_tokens`) and
 * the Responses API (`instructions`, `usage.output_tokens`). Duck-typed; no `openai` import.
 */
export const openaiAdapter: RequestAdapter = {
  provider: 'openai',
  extract(params, response) {
    if (!params || typeof params !== 'object') return null;
    const p = params as Record<string, unknown>;
    if (typeof p.model !== 'string' || !p.model) return null;

    const tools = Array.isArray(p.tools) && p.tools.length ? (p.tools as unknown[]) : undefined;

    const usage =
      response && typeof response === 'object'
        ? ((response as Record<string, unknown>).usage as Record<string, unknown> | undefined)
        : undefined;
    const promptDetails = usage?.prompt_tokens_details as Record<string, unknown> | undefined;
    const inputDetails = usage?.input_tokens_details as Record<string, unknown> | undefined;

    return {
      model: p.model,
      system: systemText(p),
      tools,
      observedOutputTokens: num(usage?.completion_tokens) ?? num(usage?.output_tokens),
      observedCacheReadTokens: num(promptDetails?.cached_tokens) ?? num(inputDetails?.cached_tokens),
      observedInputTokens: num(usage?.prompt_tokens) ?? num(usage?.input_tokens),
      timestamp: Date.now(),
    } satisfies CapturedRequest;
  },
};
