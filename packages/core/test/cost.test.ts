import { describe, expect, it } from 'vitest';
import { DAYS_PER_MONTH, costOf, ratesFor, simulateCache } from '../src/cost';
import { DEFAULT_WORKLOAD } from '../src/cost';
import { requireModel } from '../src/models';

const workload = { ...DEFAULT_WORKLOAD, requestsPerDay: 1000, outputTokens: 500 };

describe('rates', () => {
  it('prices a plain request at the published rate', () => {
    const sonnet = requireModel('claude-sonnet-5');
    const cost = costOf(sonnet, 0, 1_000_000, { ...workload, cacheHitRate: 0 });
    // 1M input tokens at $2/MTok.
    expect(cost.inputPerRequest).toBeCloseTo(2, 6);
    // 500 output tokens at $10/MTok.
    expect(cost.outputPerRequest).toBeCloseTo(0.005, 6);
  });

  it('applies the batch discount to every token category', () => {
    const opus = requireModel('claude-opus-5');
    const normal = ratesFor(opus, 1000, { ...workload, batch: false });
    const batched = ratesFor(opus, 1000, { ...workload, batch: true });
    expect(batched.input).toBeCloseTo(normal.input / 2, 6);
    expect(batched.output).toBeCloseTo(normal.output / 2, 6);
    expect(batched.cacheRead!).toBeCloseTo(normal.cacheRead! / 2, 6);
    expect(batched.batchDiscountApplied).toBe(true);
  });

  it('crosses the long-context price tier for Gemini Pro', () => {
    const pro = requireModel('gemini-3-1-pro');
    const under = ratesFor(pro, 199_000, workload);
    const over = ratesFor(pro, 201_000, workload);
    expect(under.input).toBe(2);
    expect(over.input).toBe(4);
    expect(over.longContextTier).toBe(true);
  });

  it('falls back to the base input price when a model has no cache-write surcharge', () => {
    const gpt = requireModel('gpt-5-4');
    const r = ratesFor(gpt, 1000, workload);
    expect(r.cacheWrite).toBe(gpt.pricing.input);
  });
});

describe('cache breakeven', () => {
  // Anthropic documents: a 5-minute cache pays off after one read, a 1-hour cache after two.
  // These two assertions are the check that our derivation matches the provider's own guidance.
  it('breaks even after one read on a 5-minute cache', () => {
    const model = requireModel('claude-sonnet-5');
    const sim = simulateCache(model, 5000, 500, { ...workload, cacheHitRate: 0.5, cacheTtl: '5m' });
    expect(sim.breakevenReads).toBe(1);
  });

  it('breaks even after two reads on a 1-hour cache', () => {
    const model = requireModel('claude-sonnet-5');
    const sim = simulateCache(model, 5000, 500, { ...workload, cacheHitRate: 0.5, cacheTtl: '1h' });
    expect(sim.breakevenReads).toBe(2);
  });

  it('saves money at a high hit rate and loses money at a hit rate of zero', () => {
    const model = requireModel('claude-sonnet-5');
    const good = simulateCache(model, 10_000, 200, { ...workload, cacheHitRate: 0.9 });
    expect(good.monthlySaving).toBeGreaterThan(0);

    const pointless = simulateCache(model, 10_000, 200, { ...workload, cacheHitRate: 0.01 });
    // Writing a cache that is almost never read costs the 1.25x write surcharge for nothing.
    expect(pointless.monthlySaving).toBeLessThan(0);
  });

  it('reports no saving for a model without prompt caching', () => {
    const model = requireModel('gpt-5-5-pro');
    const sim = simulateCache(model, 10_000, 200, { ...workload, cacheHitRate: 0.9 });
    expect(sim.supported).toBe(false);
    expect(sim.monthlySaving).toBe(0);
  });

  it('a 90% hit rate on a large prefix approaches the theoretical 90% input discount', () => {
    const model = requireModel('claude-sonnet-5');
    const sim = simulateCache(model, 100_000, 0, {
      ...workload,
      outputTokens: 0,
      cacheHitRate: 1,
      cacheTtl: '5m',
    });
    // Every request reads from cache at 0.1x, so cost should be a tenth.
    expect(sim.monthlyWithCache / sim.monthlyWithoutCache).toBeCloseTo(0.1, 3);
  });
});

describe('monthly projection', () => {
  it('uses a 365/12 month so a year of months equals a year', () => {
    const model = requireModel('claude-haiku-4-5');
    const cost = costOf(model, 0, 1000, workload);
    expect(cost.perMonth * 12).toBeCloseTo(cost.perYear, 6);
    expect(DAYS_PER_MONTH).toBeCloseTo(30.4167, 3);
  });
});
