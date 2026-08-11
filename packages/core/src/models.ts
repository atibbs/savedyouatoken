/**
 * Model catalog and pricing.
 *
 * This file is the single place prices live. It is maintained by hand and dated, because
 * scraping provider pricing pages at runtime would add infrastructure, a failure mode, and
 * a legal question for zero user benefit — prices change monthly, not hourly.
 *
 * All prices are USD per 1,000,000 tokens, first-party API, global/default routing.
 * Update procedure lives in docs/architecture.md ("Keeping prices honest").
 */

export const PRICES_VERIFIED_ON = '2026-08-10';

export type Provider = 'anthropic' | 'openai' | 'google';

/**
 * Which tokenizer a model uses. This matters more than most people realise: the same
 * text produces materially different token counts across families, so "how many tokens
 * is my prompt" has no single answer.
 */
export type TokenizerFamily =
  | 'o200k' // OpenAI GPT-4o / GPT-5 family. We can count this exactly.
  | 'claude-legacy' // Claude Sonnet 4.6 and earlier.
  | 'claude-next' // Claude Opus 4.7+ / Sonnet 5 / Fable 5. ~30% more tokens than claude-legacy.
  | 'gemini';

export interface PriceTier {
  /** Applies when input tokens exceed this threshold. */
  aboveInputTokens: number;
  input: number;
  output: number;
  cacheRead?: number;
}

export interface ModelPricing {
  input: number;
  output: number;
  /** Price of reading from prompt cache. Absent = model has no prompt caching. */
  cacheRead?: number;
  /** Price of writing a 5-minute-TTL cache entry. Absent = writes cost base input price. */
  cacheWrite5m?: number;
  /** Price of writing a 1-hour-TTL cache entry. */
  cacheWrite1h?: number;
  /** Async batch pricing. Absent = no batch discount modelled. */
  batchInput?: number;
  batchOutput?: number;
  /** Long-prompt pricing cliff (Gemini Pro tiers). */
  longContext?: PriceTier;
}

export interface Model {
  id: string;
  name: string;
  provider: Provider;
  family: TokenizerFamily;
  pricing: ModelPricing;
  /** Max input+output tokens. Omitted where the provider does not publish it plainly. */
  contextWindow?: number;
  /**
   * Tokens the provider silently adds to your request when any tool is defined,
   * before your own schemas. auto = tool_choice auto/none, forced = any/tool.
   */
  toolSystemPromptTokens?: { auto: number; forced: number };
  /** Not recommended for new work, but kept so people auditing old code can price it. */
  legacy?: boolean;
  /**
   * A same-family replacement that is cheaper on BOTH input and output. Only set where
   * that is verifiably true — this drives a "you are overpaying" finding, so a wrong
   * entry here is a wrong dollar figure in front of a user.
   */
  supersededBy?: string;
  note?: string;
}

const ANTHROPIC_TOOL_DEFAULT = { auto: 496, forced: 588 };

export const MODELS: Model[] = [
  // ---------------------------------------------------------------- Anthropic
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'anthropic',
    family: 'claude-next',
    contextWindow: 1_000_000,
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchInput: 2.5,
      batchOutput: 12.5,
    },
    toolSystemPromptTokens: { auto: 286, forced: 406 },
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    family: 'claude-next',
    contextWindow: 1_000_000,
    pricing: {
      input: 2,
      output: 10,
      cacheRead: 0.2,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
      batchInput: 1,
      batchOutput: 5,
    },
    toolSystemPromptTokens: { auto: 354, forced: 474 },
    note: 'Introductory pricing through 2026-08-31. From 2026-09-01 this becomes $3 / $15 per MTok.',
  },
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'anthropic',
    family: 'claude-next',
    contextWindow: 1_000_000,
    pricing: {
      input: 10,
      output: 50,
      cacheRead: 1,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
      batchInput: 5,
      batchOutput: 25,
    },
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    provider: 'anthropic',
    family: 'claude-next',
    contextWindow: 1_000_000,
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchInput: 2.5,
      batchOutput: 12.5,
    },
    toolSystemPromptTokens: { auto: 290, forced: 410 },
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    family: 'claude-next',
    contextWindow: 1_000_000,
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchInput: 2.5,
      batchOutput: 12.5,
    },
    toolSystemPromptTokens: { auto: 675, forced: 804 },
    note: 'First model on the newer Claude tokenizer.',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 1_000_000,
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchInput: 2.5,
      batchOutput: 12.5,
    },
    toolSystemPromptTokens: { auto: 497, forced: 589 },
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 200_000,
    pricing: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchInput: 2.5,
      batchOutput: 12.5,
    },
    toolSystemPromptTokens: ANTHROPIC_TOOL_DEFAULT,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 1_000_000,
    pricing: {
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      batchInput: 1.5,
      batchOutput: 7.5,
    },
    toolSystemPromptTokens: { auto: 497, forced: 589 },
    note: 'Last Claude model on the previous tokenizer.',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 200_000,
    pricing: {
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      batchInput: 1.5,
      batchOutput: 7.5,
    },
    toolSystemPromptTokens: ANTHROPIC_TOOL_DEFAULT,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 200_000,
    pricing: {
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
      batchInput: 0.5,
      batchOutput: 2.5,
    },
    toolSystemPromptTokens: ANTHROPIC_TOOL_DEFAULT,
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 200_000,
    legacy: true,
    supersededBy: 'claude-opus-4-5',
    pricing: {
      input: 15,
      output: 75,
      cacheRead: 1.5,
      cacheWrite5m: 18.75,
      cacheWrite1h: 30,
      batchInput: 7.5,
      batchOutput: 37.5,
    },
    toolSystemPromptTokens: { auto: 313, forced: 315 },
    note: 'Retired on the first-party API; still available on Bedrock and Google Cloud.',
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    family: 'claude-legacy',
    contextWindow: 200_000,
    legacy: true,
    pricing: {
      input: 0.8,
      output: 4,
      cacheRead: 0.08,
      cacheWrite5m: 1,
      cacheWrite1h: 1.6,
      batchInput: 0.4,
      batchOutput: 2,
    },
    toolSystemPromptTokens: { auto: 264, forced: 355 },
  },

  // ------------------------------------------------------------------ OpenAI
  {
    id: 'gpt-5-6-sol',
    name: 'GPT-5.6 Sol',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 1_050_000,
    pricing: { input: 5, output: 30, cacheRead: 0.5, cacheWrite5m: 6.25 },
  },
  {
    id: 'gpt-5-6-terra',
    name: 'GPT-5.6 Terra',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 1_050_000,
    pricing: { input: 2, output: 12, cacheRead: 0.2, cacheWrite5m: 2.5 },
  },
  {
    id: 'gpt-5-6-luna',
    name: 'GPT-5.6 Luna',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 1_050_000,
    pricing: { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite5m: 0.25 },
  },
  {
    id: 'gpt-5-5',
    name: 'GPT-5.5',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 5, output: 30, cacheRead: 0.5 },
  },
  {
    id: 'gpt-5-5-pro',
    name: 'GPT-5.5 Pro',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 30, output: 180 },
  },
  {
    id: 'gpt-5-4',
    name: 'GPT-5.4',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 2.5, output: 15, cacheRead: 0.25 },
  },
  {
    id: 'gpt-5-4-mini',
    name: 'GPT-5.4 mini',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 0.75, output: 4.5, cacheRead: 0.075 },
  },
  {
    id: 'gpt-5-4-nano',
    name: 'GPT-5.4 nano',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 0.2, output: 1.25, cacheRead: 0.02 },
  },
  {
    id: 'gpt-5-2',
    name: 'GPT-5.2',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 1.75, output: 14, cacheRead: 0.175 },
  },
  {
    id: 'gpt-5-1',
    name: 'GPT-5.1',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 1.25, output: 10, cacheRead: 0.125 },
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 1.25, output: 10, cacheRead: 0.125 },
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 0.25, output: 2, cacheRead: 0.025 },
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    provider: 'openai',
    family: 'o200k',
    pricing: { input: 0.05, output: 0.4, cacheRead: 0.005 },
  },
  {
    id: 'gpt-4-1',
    name: 'GPT-4.1',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 1_047_576,
    legacy: true,
    pricing: { input: 2, output: 8, cacheRead: 0.5 },
  },
  {
    id: 'gpt-4-1-mini',
    name: 'GPT-4.1 mini',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 1_047_576,
    legacy: true,
    pricing: { input: 0.4, output: 1.6, cacheRead: 0.1 },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 128_000,
    legacy: true,
    pricing: { input: 2.5, output: 10, cacheRead: 1.25 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    family: 'o200k',
    contextWindow: 128_000,
    legacy: true,
    pricing: { input: 0.15, output: 0.6, cacheRead: 0.075 },
  },

  // ------------------------------------------------------------------ Google
  {
    id: 'gemini-3-6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'google',
    family: 'gemini',
    pricing: { input: 1.5, output: 7.5, cacheRead: 0.15 },
  },
  {
    id: 'gemini-3-5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    family: 'gemini',
    pricing: { input: 1.5, output: 9, cacheRead: 0.15 },
  },
  {
    id: 'gemini-3-5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'google',
    family: 'gemini',
    pricing: { input: 0.3, output: 2.5, cacheRead: 0.03 },
  },
  {
    id: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'google',
    family: 'gemini',
    pricing: {
      input: 2,
      output: 12,
      cacheRead: 0.2,
      longContext: { aboveInputTokens: 200_000, input: 4, output: 18, cacheRead: 0.4 },
    },
    note: 'Input price doubles above a 200k-token prompt.',
  },
  {
    id: 'gemini-3-1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'google',
    family: 'gemini',
    pricing: { input: 0.25, output: 1.5, cacheRead: 0.025 },
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash Preview',
    provider: 'google',
    family: 'gemini',
    pricing: { input: 0.5, output: 3, cacheRead: 0.05 },
  },
  {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    family: 'gemini',
    contextWindow: 1_048_576,
    legacy: true,
    pricing: {
      input: 1.25,
      output: 10,
      cacheRead: 0.125,
      longContext: { aboveInputTokens: 200_000, input: 2.5, output: 15, cacheRead: 0.25 },
    },
    note: 'Input price doubles above a 200k-token prompt.',
  },
  {
    id: 'gemini-2-5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    family: 'gemini',
    contextWindow: 1_048_576,
    legacy: true,
    pricing: { input: 0.3, output: 2.5, cacheRead: 0.03 },
  },
  {
    id: 'gemini-2-5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'google',
    family: 'gemini',
    contextWindow: 1_048_576,
    legacy: true,
    pricing: { input: 0.1, output: 0.4, cacheRead: 0.01 },
  },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-5';

const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: string): Model | undefined {
  return BY_ID.get(id);
}

export function requireModel(id: string): Model {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`Unknown model: ${id}`);
  return m;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

export function modelsByProvider(includeLegacy = true): Array<[Provider, Model[]]> {
  const providers: Provider[] = ['anthropic', 'openai', 'google'];
  return providers.map((p) => [p, MODELS.filter((m) => m.provider === p && (includeLegacy || !m.legacy))]);
}
