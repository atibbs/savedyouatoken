import type { CapturedRequest, RequestAdapter } from '../types';

/**
 * Text of one message's `content`, which may be a string or an array of content parts —
 * `{ text }`, `{ type: 'text', text }`, or the Responses API `{ type: 'input_text', text }`.
 */
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

/** Extract text from every item in a list, regardless of role — used for `instructions`, which is all system-level. */
function textFromAnyItems(items: unknown[]): string {
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const o = item as { text?: unknown; content?: unknown };
        if (typeof o.text === 'string') return o.text;
        if (o.content != null) return textFromContent(o.content);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Extract text from only the system/developer items in a `messages` / `input` list. */
function textFromRoleItems(items: unknown[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    if (role === 'system' || role === 'developer') {
      parts.push(textFromContent((item as { content?: unknown }).content));
    }
  }
  return parts.filter(Boolean).join('\n');
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Collect the system/developer prompt across every OpenAI request style:
 * - Chat Completions `messages` (system/developer roles),
 * - Responses API `instructions` (a string, or an input-item array),
 * - Responses API `input` (an item array that may itself carry system/developer messages).
 * Missing a system prompt here would silently produce wrong token counts, so all three are read.
 */
function systemText(p: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof p.instructions === 'string' && p.instructions) parts.push(p.instructions);
  else if (Array.isArray(p.instructions)) parts.push(textFromAnyItems(p.instructions));
  if (Array.isArray(p.messages)) parts.push(textFromRoleItems(p.messages));
  if (Array.isArray(p.input)) parts.push(textFromRoleItems(p.input));
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
