import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { collectingSink, testCounter, anthropicRequest } from './helpers';
import { DEFAULT_REQUESTS_PER_DAY } from '../src/traffic';

describe('reports reflect matured workload', () => {
  it('re-emits with an accumulated, measured workload once traffic matures', () => {
    let clock = 1_000_000;
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      sink,
      now: () => clock,
      // Test-shrunk maturity thresholds (production defaults are 20 obs over 5 minutes).
      minObservationsForMaturity: 5,
      minSpanMsForMaturity: 1000,
    });

    // First sight: provisional workload (nothing measured yet).
    for (let i = 0; i < 6; i++) {
      auditor.observe(anthropicRequest(), { usage: { output_tokens: 300 } });
      clock += 1000;
    }

    const analyses = events.filter((e) => e.kind === 'analysis');
    expect(analyses.length).toBeGreaterThanOrEqual(2);

    const first = analyses[0]!;
    const last = analyses[analyses.length - 1]!;
    if (first.kind !== 'analysis' || last.kind !== 'analysis') throw new Error('expected analysis events');

    // The first report is provisional; the last reflects matured, measured traffic.
    expect(first.matured).toBe(false);
    expect(first.report.workload.requestsPerDay).toBe(DEFAULT_REQUESTS_PER_DAY);
    expect(last.matured).toBe(true);
    expect(last.report.workload.requestsPerDay).not.toBe(DEFAULT_REQUESTS_PER_DAY);
    // Measured output length comes from the observed responses, not a default.
    expect(last.report.workload.outputTokens).toBe(300);
  });
});
