import type { Rule } from '../types';
import { DAYS_PER_MONTH, costOf, formatUsd, ratesFor } from '../cost';
import { FAMILY_FACTOR } from '../tokens';
import { getModel } from '../models';

export const tokenizerFamilyShift: Rule = {
  id: 'tokenizer-family-shift',
  title: 'This model counts your prompt differently',
  severity: 'medium',
  category: 'model',
  autofix: false,
  summary: 'The same text is not the same number of tokens on every model. Upgrades can raise your bill silently.',
  why: [
    'A token is a unit of a specific tokenizer, not a unit of text. Two models can read an identical prompt and bill you for different amounts, because their vocabularies were built differently.',
    'Anthropic documents that the tokenizer introduced with Claude Opus 4.7 produces approximately 30% more tokens for the same text than the previous Claude tokenizer. That is a real effect with a real invoice consequence: a team that moved from Sonnet 4.6 to a 4.7-or-later model without touching a character of their prompt saw their input token count rise by roughly a third.',
    'The trap is that per-token prices are what get compared when people evaluate a migration. A model at the same headline price per million tokens is not the same price per request if it counts more tokens.',
    'When you compare models, compare cost per request on your actual prompt — which is what the comparison table on this page does — rather than cost per million tokens.',
  ],
  example: {
    before: 'Sonnet 4.6: 4,000 tokens per request at $3/MTok.',
    after: 'A 4.7-or-later model: roughly 5,200 tokens for the same text. Same words, 30% more tokens.',
  },
  detect(ctx) {
    if (ctx.model.family !== 'claude-next') return null;
    const tokens = ctx.inputTokens;
    const legacyEquivalent = Math.round(tokens / FAMILY_FACTOR['claude-next']);
    const extra = tokens - legacyEquivalent;
    if (extra < 50) return null;

    const rates = ratesFor(ctx.model, tokens, ctx.workload);
    const monthly = (extra * rates.input * ctx.workload.requestsPerDay * DAYS_PER_MONTH) / 1_000_000;

    return {
      occurrences: 1,
      detail: `${ctx.model.name} uses Anthropic's newer tokenizer, which produces about 30% more tokens for the same text. This prompt is roughly ${tokens.toLocaleString('en-US')} tokens here against about ${legacyEquivalent.toLocaleString('en-US')} on Sonnet 4.6 — a difference of ${formatUsd(monthly)} a month at this volume, before any prompt changes.`,
    };
  },
};

export const longContextTier: Rule = {
  id: 'long-context-price-tier',
  title: 'Your prompt crossed a pricing cliff',
  severity: 'high',
  category: 'model',
  autofix: false,
  summary: 'Some models double their input price above a prompt-size threshold.',
  why: [
    'Long-context pricing is not always linear. Google\'s Pro tiers charge one rate up to a 200,000-token prompt and roughly double it above that. The jump applies to the whole request, not just the tokens past the line.',
    'That makes the threshold a genuine cliff. A prompt at 199,000 tokens and one at 201,000 tokens differ by one percent in size and by about a hundred percent in price.',
    'If you are near a threshold, it is worth knowing exactly where you sit. Trimming retrieved context to stay below the line is often the single highest-value optimisation available, and it is invisible unless you are looking for it.',
  ],
  example: {
    before: '210k-token prompt billed at the high tier: every token costs double.',
    after: '190k-token prompt after trimming retrieval: the whole request drops to the base tier.',
  },
  detect(ctx) {
    const tier = ctx.model.pricing.longContext;
    if (!tier) return null;
    const tokens = ctx.inputTokens;
    if (tokens <= tier.aboveInputTokens) {
      // Warn when within 15% of the cliff.
      if (tokens > tier.aboveInputTokens * 0.85) {
        return {
          occurrences: 1,
          detail: `At ${tokens.toLocaleString('en-US')} tokens this prompt is within ${Math.round(((tier.aboveInputTokens - tokens) / tier.aboveInputTokens) * 100)}% of ${ctx.model.name}'s ${tier.aboveInputTokens.toLocaleString('en-US')}-token threshold, above which input costs $${tier.input} per million instead of $${ctx.model.pricing.input}.`,
        };
      }
      return null;
    }

    const above = costOf(ctx.model, 0, tokens, ctx.workload);
    const below = costOf(ctx.model, 0, tier.aboveInputTokens, ctx.workload);
    const saving = above.perMonth - below.perMonth;
    return {
      occurrences: 1,
      monthlySaving: Math.max(0, saving),
      detail: `At ${tokens.toLocaleString('en-US')} tokens this prompt is over ${ctx.model.name}'s ${tier.aboveInputTokens.toLocaleString('en-US')}-token threshold, so the entire request is billed at $${tier.input} per million instead of $${ctx.model.pricing.input}. Getting back under the line is worth about ${formatUsd(Math.max(0, saving))} a month.`,
    };
  },
};

export const contextWindowPressure: Rule = {
  id: 'context-window-pressure',
  title: 'Running out of room',
  severity: 'medium',
  category: 'model',
  autofix: false,
  summary: 'A prompt filling most of the context window leaves nothing for the conversation.',
  why: [
    'The context window holds your prompt, the conversation so far, tool results, and the response. A system prompt occupying most of it does not fail immediately — it fails on the fourth turn, in production, when the history finally overflows.',
    'Truncation failures are unpleasant to debug because they depend on conversation length rather than on any single request. The symptom is a model that suddenly forgets its instructions.',
    'A rough guide: if the static prompt is over about 60% of the window, either the window is too small for the job or the prompt is carrying content that belongs in retrieval.',
  ],
  example: {
    before: '140k-token prompt in a 200k window: four turns of history and you are truncating.',
    after: 'A 20k prompt plus retrieval that fetches only what the current turn needs.',
  },
  detect(ctx) {
    const window = ctx.model.contextWindow;
    if (!window) return null;
    const tokens = ctx.inputTokens;
    const share = tokens / window;
    if (share < 0.6) return null;
    return {
      occurrences: 1,
      detail: `This prompt is ${Math.round(share * 100)}% of ${ctx.model.name}'s ${window.toLocaleString('en-US')}-token context window, leaving about ${(window - tokens).toLocaleString('en-US')} tokens for history, tool results and the response.`,
    };
  },
};

export const supersededModel: Rule = {
  id: 'superseded-model',
  title: 'A newer model at a lower price',
  severity: 'high',
  category: 'model',
  autofix: false,
  summary: "Some model upgrades cost less on both input and output than the model you're currently using.",
  why: [
    'Model pricing does not move in one direction. Providers periodically ship a model that is both better and cheaper than the one it replaces, and the older one stays available for compatibility.',
    'Pinned model identifiers are how teams end up on the wrong side of that. A version string set eighteen months ago in a config file keeps working, so nobody revisits it, and the bill quietly stays at the old rate.',
    'This finding only fires where the replacement is cheaper on both input and output within the same model family. It is not a general recommendation to chase new releases — most upgrades cost more, and this tool will tell you when they do.',
    'Validate on your evals before switching. "Cheaper and newer" is a strong prior, not a guarantee for your specific task.',
  ],
  example: {
    before: 'Claude Opus 4.1 at $15 / $75 per million tokens.',
    after: 'Claude Opus 4.5 at $5 / $25 — a third of the price, in the same family.',
  },
  detect(ctx) {
    const replacementId = ctx.model.supersededBy;
    if (!replacementId) return null;
    const replacement = getModel(replacementId);
    if (!replacement) return null;

    const tokens = ctx.inputTokens;
    const current = costOf(ctx.model, 0, tokens, ctx.workload);
    // Token counts differ across tokenizer families, so re-count for the replacement.
    const replacementTokens =
      ctx.model.family === replacement.family
        ? tokens
        : Math.round((tokens / FAMILY_FACTOR[ctx.model.family]) * FAMILY_FACTOR[replacement.family]);
    const next = costOf(replacement, 0, replacementTokens, ctx.workload);
    const saving = current.perMonth - next.perMonth;
    if (saving <= 0) return null;

    return {
      occurrences: 1,
      monthlySaving: saving,
      detail: `${replacement.name} is cheaper than ${ctx.model.name} on both input and output. On this workload that is about ${formatUsd(saving)} a month — ${Math.round((saving / current.perMonth) * 100)}% — before changing anything in the prompt.`,
    };
  },
};

export const outputDominatesBill: Rule = {
  id: 'output-dominates-bill',
  title: 'Output is most of this bill',
  severity: 'medium',
  category: 'model',
  autofix: false,
  summary: 'When output is most of the bill, shortening the prompt barely moves the total.',
  why: [
    'Output tokens cost five to six times more than input tokens on most models. A workload that generates long responses can spend the large majority of its budget on completions, in which case prompt optimisation has a small ceiling no matter how thorough it is.',
    'This is worth knowing before you spend a day compressing a system prompt. If output is 80% of the bill, halving the prompt changes the total by ten percent.',
    'The levers that matter for output are different ones: cap `max_tokens` to something your product can actually display, ask for the shortest useful form rather than an essay, avoid instructing the model to restate the question or explain its reasoning when you will not show it, and use a schema so it emits fields instead of prose.',
    'Reasoning models add a wrinkle: thinking tokens are billed as output even though nobody reads them. If you are on a reasoning model for a task that does not need it, that is the first thing to check.',
  ],
  example: {
    before: '2,000-token prompt, 3,000-token response. Prompt is 12% of the bill.',
    after: 'Cap the response at 400 tokens and the bill falls by more than half.',
  },
  detect(ctx) {
    const breakdown = costOf(ctx.model, 0, ctx.inputTokens, ctx.workload);
    if (breakdown.perRequest === 0) return null;
    const outputShare = breakdown.outputPerRequest / breakdown.perRequest;
    if (outputShare < 0.6) return null;

    return {
      occurrences: 1,
      detail: `Output is ${Math.round(outputShare * 100)}% of this bill (${formatUsd(breakdown.outputPerRequest * ctx.workload.requestsPerDay * DAYS_PER_MONTH)} a month against ${formatUsd(breakdown.inputPerRequest * ctx.workload.requestsPerDay * DAYS_PER_MONTH)} for input). Shortening responses will move the number more than shortening the prompt.`,
    };
  },
};
