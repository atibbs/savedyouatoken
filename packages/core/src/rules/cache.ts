import type { Rule } from '../types';
import { DAYS_PER_MONTH, ratesFor, simulateCache } from '../cost';
import { formatUsd } from '../cost';

/** Providers require a minimum prefix length before a cache breakpoint is honoured. */
export const MIN_CACHEABLE_TOKENS = 1024;

/** When the user has not told us their reuse rate, reason about a representative one. */
const ASSUMED_HIT_RATE = 0.8;

/* --------------------------------------------------- dynamic content up front */

export const cacheHostileOrder: Rule = {
  id: 'cache-hostile-order',
  title: 'Per-request values above your static content',
  severity: 'high',
  category: 'caching',
  autofix: false,
  summary: 'A cache prefix ends at the first byte that changes. Anything after it pays full price forever.',
  why: [
    'Prompt caching matches a prefix. The provider hashes your prompt from the beginning and reuses the longest run that is byte-identical to a previous request. The moment it reaches something that changed — a timestamp, a user name, a retrieved document — matching stops.',
    'So a single dynamic value near the top of a prompt disables caching for everything below it. Today\'s date on line three can cost you the cache on four thousand tokens of instructions, examples and tool documentation that never change.',
    'The fix is ordering, not deletion. Put everything static first — role, rules, examples, schemas — then the cache breakpoint, then the per-request material. It is usually a ten-minute change to a template and one of the largest single savings available.',
    'A useful habit: treat the top of your prompt as immutable and append-only. If you find yourself interpolating a variable into it, ask whether that variable could move to the user message instead.',
  ],
  example: {
    before: "Today's date is 2026-08-10.\n\n<4,000 tokens of static rules and examples>\n\nUser question: {{q}}",
    after: '<4,000 tokens of static rules and examples>\n\n[cache breakpoint]\n\nToday\'s date is 2026-08-10.\nUser question: {{q}}',
  },
  detect(ctx) {
    if (ctx.model.pricing.cacheRead == null) return null;

    const firstDynamic = ctx.blocks.find((b) => b.dynamic);
    if (!firstDynamic) return null;

    const stranded = ctx.blocks.filter((b) => b.start > firstDynamic.start && !b.dynamic);
    if (!stranded.length) return null;

    const strandedTokens = stranded.reduce((sum, b) => sum + ctx.count(b.text), 0);
    if (strandedTokens < 200) return null;

    const hitRate = ctx.workload.cacheHitRate > 0 ? ctx.workload.cacheHitRate : ASSUMED_HIT_RATE;
    const rates = ratesFor(ctx.model, strandedTokens, ctx.workload);
    const read = rates.cacheRead ?? rates.input;
    // Per token, a hit costs `read` instead of `input`; misses still pay a write surcharge.
    const perTokenSaving = hitRate * (rates.input - read) - (1 - hitRate) * (rates.cacheWrite - rates.input);
    const monthly =
      (strandedTokens * perTokenSaving * ctx.workload.requestsPerDay * DAYS_PER_MONTH) / 1_000_000;

    const assumed =
      ctx.workload.cacheHitRate > 0
        ? ''
        : ` (assuming an ${Math.round(ASSUMED_HIT_RATE * 100)}% cache hit rate)`;
    return {
      ranges: stranded.map((b) => ({ start: b.start, end: b.end })),
      occurrences: stranded.length,
      wastedTokens: strandedTokens,
      monthlySaving: Math.max(0, monthly),
      detail: `${strandedTokens.toLocaleString('en-US')} tokens of static content sit below ${firstDynamic.dynamicReason ?? 'a per-request value'}, so they can never be cached. Moving them above it is worth about ${formatUsd(Math.max(0, monthly))} a month${assumed}.`,
    };
  },
};

/* ------------------------------------------------------- caching not enabled */

export const cacheOpportunity: Rule = {
  id: 'no-prompt-caching',
  title: 'A cacheable prompt, uncached',
  severity: 'high',
  category: 'caching',
  autofix: false,
  summary: 'Reading a cached prefix costs a tenth of sending it again. This prompt qualifies.',
  why: [
    'Prompt caching is the largest single lever in LLM cost control, and it is a configuration change rather than a rewrite. A cache read is billed at roughly a tenth of the base input rate on the major providers.',
    'The arithmetic is worth internalising. A write costs 1.25x the base rate for a short time-to-live, and each read costs 0.1x. So one write plus one read costs 1.35x against 2x for sending it twice — caching pays for itself on the second request. With a longer time-to-live the write costs 2x and you need two reads to break even.',
    'That means the only workloads caching hurts are ones where the prefix is genuinely used once and thrown away. Everything else — any repeated system prompt, any multi-turn conversation, any agent loop — should be caching.',
    'The prerequisites are a prefix above the provider minimum (about a thousand tokens) that is byte-identical between requests. If yours is not identical, that is usually the ordering problem rather than a caching problem.',
  ],
  example: {
    before: '6,000-token system prompt sent at full price on all 40,000 daily requests.',
    after: 'Same prompt behind a cache breakpoint: writes on misses, reads at a tenth of the price on hits.',
  },
  detect(ctx) {
    if (ctx.model.pricing.cacheRead == null) return null;
    if (ctx.workload.cacheHitRate > 0) return null; // Already modelling caching.

    // Static content is everything before the first per-request value.
    const firstDynamic = ctx.blocks.find((b) => b.dynamic);
    const staticEnd = firstDynamic ? firstDynamic.start : ctx.prompt.length;
    // Tool schemas are static and sit ahead of the system prompt in the request, so they
    // are part of the cacheable prefix.
    const staticTokens = ctx.count(ctx.prompt.slice(0, staticEnd)) + ctx.toolTokens;
    if (staticTokens < MIN_CACHEABLE_TOKENS) return null;
    if (ctx.workload.requestsPerDay < 2) return null;

    const dynamicTokens = Math.max(0, ctx.inputTokens - staticTokens);
    const sim = simulateCache(ctx.model, staticTokens, dynamicTokens, {
      ...ctx.workload,
      cacheHitRate: ASSUMED_HIT_RATE,
    });
    if (sim.monthlySaving <= 0) return null;

    return {
      ranges: [{ start: 0, end: staticEnd }],
      occurrences: 1,
      monthlySaving: sim.monthlySaving,
      detail: `${staticTokens.toLocaleString('en-US')} tokens are identical on every request and are being re-sent at full price. At an ${Math.round(ASSUMED_HIT_RATE * 100)}% hit rate, caching them saves about ${formatUsd(sim.monthlySaving)} a month — ${Math.round(sim.savingPercent)}% of this bill. Caching pays off after ${sim.breakevenReads} read${sim.breakevenReads === 1 ? '' : 's'}.`,
    };
  },
};

/* ---------------------------------------------------------- cache TTL choice */

export const cacheTtlMismatch: Rule = {
  id: 'cache-ttl-mismatch',
  title: 'A one-hour cache for a five-minute workload',
  severity: 'medium',
  category: 'caching',
  autofix: false,
  summary: 'Longer cache lifetimes cost more to write. They only pay back if you actually reuse them.',
  why: [
    'The extended cache time-to-live is not free: the write costs twice the base input rate rather than 1.25x. You are pre-paying for the privilege of a longer window.',
    'That pre-payment needs two reads to break even instead of one. On a busy endpoint that is trivially satisfied. On a low-traffic internal tool with a request every twenty minutes, the longer window is genuinely the right call — the short cache would have expired.',
    'The mistake in both directions comes from choosing the time-to-live by feel rather than from request spacing. If your median gap between requests is under the shorter window, the cheaper write wins.',
  ],
  example: {
    before: '1-hour cache write at 2x base rate, on a prompt reused every few seconds.',
    after: '5-minute cache write at 1.25x, refreshed continuously by the traffic itself.',
  },
  detect(ctx) {
    if (ctx.workload.cacheTtl !== '1h') return null;
    if (ctx.model.pricing.cacheWrite1h == null || ctx.model.pricing.cacheWrite5m == null) return null;

    // Median gap between requests, in minutes, assuming even spacing.
    const gapMinutes = (24 * 60) / Math.max(1, ctx.workload.requestsPerDay);
    if (gapMinutes >= 4) return null; // The long TTL is genuinely justified.

    const staticTokens = ctx.inputTokens;
    const short = simulateCache(ctx.model, staticTokens, 0, { ...ctx.workload, cacheTtl: '5m' });
    const long = simulateCache(ctx.model, staticTokens, 0, ctx.workload);
    const saving = long.monthlyWithCache - short.monthlyWithCache;
    if (saving <= 0) return null;

    return {
      occurrences: 1,
      monthlySaving: saving,
      detail: `At ${ctx.workload.requestsPerDay.toLocaleString('en-US')} requests a day, a request arrives roughly every ${gapMinutes < 1 ? `${Math.round(gapMinutes * 60)} seconds` : `${gapMinutes.toFixed(1)} minutes`} — the traffic keeps a five-minute cache warm by itself. The cheaper write saves about ${formatUsd(saving)} a month.`,
    };
  },
};
