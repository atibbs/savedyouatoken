/**
 * Cost arithmetic. Everything the product claims in dollars comes from this file.
 */

import type { Model } from './models';

export const DAYS_PER_MONTH = 365 / 12; // 30.4167

export type CacheTtl = '5m' | '1h';

export interface Workload {
  /** How many times this prompt is sent per day. */
  requestsPerDay: number;
  /** Average completion length. Output is usually the larger half of a bill. */
  outputTokens: number;
  /**
   * Fraction of requests (0..1) that would land on a warm prompt cache.
   * 0 means caching is off or never hits.
   */
  cacheHitRate: number;
  cacheTtl: CacheTtl;
  /** Async batch API, where the provider offers one. */
  batch: boolean;
}

export const DEFAULT_WORKLOAD: Workload = {
  requestsPerDay: 1000,
  outputTokens: 500,
  cacheHitRate: 0,
  cacheTtl: '5m',
  batch: false,
};

export interface Rates {
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number;
  /** True when the long-prompt price tier applied. */
  longContextTier: boolean;
  batchDiscountApplied: boolean;
}

/**
 * Resolve the per-1M-token rates that actually apply to a request of this size.
 * Handles long-context price tiers, batch discounts and cache-write surcharges.
 */
export function ratesFor(model: Model, inputTokens: number, workload: Workload): Rates {
  const p = model.pricing;
  const tier = p.longContext && inputTokens > p.longContext.aboveInputTokens ? p.longContext : null;

  let input = tier?.input ?? p.input;
  let output = tier?.output ?? p.output;
  let cacheRead = tier?.cacheRead ?? p.cacheRead ?? null;

  // Cache writes: providers either publish a surcharge or charge the base input rate.
  let cacheWrite =
    workload.cacheTtl === '1h'
      ? (p.cacheWrite1h ?? (p.cacheWrite5m != null ? p.cacheWrite5m * 1.6 : input))
      : (p.cacheWrite5m ?? input);
  if (tier && p.cacheWrite5m != null) {
    // Scale the published surcharge into the long-context tier.
    cacheWrite *= tier.input / p.input;
  }

  let batchDiscountApplied = false;
  if (workload.batch && p.batchInput != null && p.batchOutput != null) {
    const inFactor = p.batchInput / p.input;
    const outFactor = p.batchOutput / p.output;
    input *= inFactor;
    output *= outFactor;
    cacheWrite *= inFactor;
    if (cacheRead != null) cacheRead *= inFactor;
    batchDiscountApplied = true;
  }

  return { input, output, cacheRead, cacheWrite, longContextTier: tier != null, batchDiscountApplied };
}

export interface CostBreakdown {
  inputPerRequest: number;
  outputPerRequest: number;
  perRequest: number;
  perDay: number;
  perMonth: number;
  perYear: number;
  rates: Rates;
}

const PER_MILLION = 1_000_000;

/**
 * Cost of a workload where `staticTokens` may be served from cache and `dynamicTokens`
 * are always charged at the base input rate.
 */
export function costOf(
  model: Model,
  staticTokens: number,
  dynamicTokens: number,
  workload: Workload,
): CostBreakdown {
  const totalInput = staticTokens + dynamicTokens;
  const rates = ratesFor(model, totalInput, workload);

  const hit = rates.cacheRead == null ? 0 : clamp01(workload.cacheHitRate);
  const miss = 1 - hit;

  // On a miss the static prefix is written to cache; on a hit it is read back.
  const staticCost =
    hit === 0
      ? (staticTokens * rates.input) / PER_MILLION
      : (staticTokens * (miss * rates.cacheWrite + hit * (rates.cacheRead ?? rates.input))) / PER_MILLION;

  const dynamicCost = (dynamicTokens * rates.input) / PER_MILLION;
  const inputPerRequest = staticCost + dynamicCost;
  const outputPerRequest = (workload.outputTokens * rates.output) / PER_MILLION;
  const perRequest = inputPerRequest + outputPerRequest;
  const perDay = perRequest * workload.requestsPerDay;

  return {
    inputPerRequest,
    outputPerRequest,
    perRequest,
    perDay,
    perMonth: perDay * DAYS_PER_MONTH,
    perYear: perDay * 365,
    rates,
  };
}

/** Convenience: no caching, all input charged at base rate. */
export function costUncached(model: Model, inputTokens: number, workload: Workload): CostBreakdown {
  return costOf(model, 0, inputTokens, { ...workload, cacheHitRate: 0 });
}

export interface CacheSimulation {
  supported: boolean;
  staticTokens: number;
  dynamicTokens: number;
  hitRate: number;
  ttl: CacheTtl;
  monthlyWithoutCache: number;
  monthlyWithCache: number;
  monthlySaving: number;
  savingPercent: number;
  /** Reads required after a write before caching is cheaper than not caching. */
  breakevenReads: number;
  /** True when the prompt is reused often enough that caching is clearly worth it. */
  worthIt: boolean;
}

/**
 * Model what prompt caching would do to this bill.
 *
 * The breakeven derivation: a write costs W per token and each read costs R, versus paying
 * the base rate B every time. Over one write plus k reads, caching costs W + kR and not
 * caching costs (k+1)B, so caching wins when k > (W - B) / (B - R).
 *
 * Sanity check against Anthropic's published guidance: with W = 1.25B and R = 0.1B this
 * gives k > 0.278, i.e. one read. With a 1-hour write at W = 2B it gives k > 1.11, i.e. two
 * reads. Those are exactly the numbers Anthropic documents.
 */
export function simulateCache(
  model: Model,
  staticTokens: number,
  dynamicTokens: number,
  workload: Workload,
): CacheSimulation {
  const hitRate = clamp01(workload.cacheHitRate);
  const withoutCache = costOf(model, 0, staticTokens + dynamicTokens, { ...workload, cacheHitRate: 0 });

  if (model.pricing.cacheRead == null || staticTokens === 0) {
    return {
      supported: model.pricing.cacheRead != null,
      staticTokens,
      dynamicTokens,
      hitRate,
      ttl: workload.cacheTtl,
      monthlyWithoutCache: withoutCache.perMonth,
      monthlyWithCache: withoutCache.perMonth,
      monthlySaving: 0,
      savingPercent: 0,
      breakevenReads: 0,
      worthIt: false,
    };
  }

  const withCache = costOf(model, staticTokens, dynamicTokens, { ...workload, cacheHitRate: hitRate });
  const rates = withCache.rates;
  const B = rates.input;
  const R = rates.cacheRead ?? B;
  const W = rates.cacheWrite;

  let breakevenReads = 0;
  if (W > B) {
    const x = (W - B) / (B - R);
    breakevenReads = Math.floor(x) + 1;
  }

  const saving = withoutCache.perMonth - withCache.perMonth;
  return {
    supported: true,
    staticTokens,
    dynamicTokens,
    hitRate,
    ttl: workload.cacheTtl,
    monthlyWithoutCache: withoutCache.perMonth,
    monthlyWithCache: withCache.perMonth,
    monthlySaving: saving,
    savingPercent: withoutCache.perMonth > 0 ? (saving / withoutCache.perMonth) * 100 : 0,
    breakevenReads,
    worthIt: saving > 0,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Format a dollar amount at a sensible precision for its magnitude. */
export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return '$0';
  if (abs < 0.01) return `$${n.toFixed(4)}`;
  if (abs < 1) return `$${n.toFixed(3)}`;
  if (abs < 1000) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function formatTokens(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** A per-million-token rate, written the way a price list writes it. */
export function formatRate(n: number | undefined): string {
  if (n == null) return '—';
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(n < 0.1 ? 3 : 2)}`;
}
