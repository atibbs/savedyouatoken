import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { collectingSink, testCounter, FIXED_WORKLOAD, anthropicRequest } from './helpers';

const base = { counter: testCounter(), workload: FIXED_WORKLOAD };

describe('deduplicated, sampled analysis', () => {
  it('analyses a repeated identical shape once, not once per request', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { ...base, sink });
    for (let i = 0; i < 50; i++) auditor.observe(anthropicRequest(), { usage: { output_tokens: 100 } });
    const analyses = events.filter((e) => e.kind === 'analysis');
    expect(analyses).toHaveLength(1);
  });

  it('analyses a changed shape promptly', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { ...base, sink });
    auditor.observe(anthropicRequest());
    // A different tool set is a different shape.
    auditor.observe(anthropicRequest({ tools: [{ name: 'other', description: 'x', input_schema: {} }] }));
    const shapeKeys = new Set(events.filter((e) => e.kind === 'analysis').map((e) => e.shapeKey));
    expect(shapeKeys.size).toBe(2);
  });

  it('collapses an interpolated timestamp to a single stable shape', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { ...base, sink });
    for (let i = 0; i < 12; i++) {
      const stamp = `2026-08-12T10:${String(i).padStart(2, '0')}:00Z`;
      auditor.observe({
        model: 'claude-sonnet-5',
        system: `You are a careful assistant.\nThe current time is ${stamp}.\nAlways be concise.`,
      });
    }
    const analyses = events.filter((e) => e.kind === 'analysis');
    const shapeKeys = new Set(analyses.map((e) => e.shapeKey));
    // One shape despite the changing timestamp, and far fewer emissions than requests.
    expect(shapeKeys.size).toBe(1);
    expect(analyses.length).toBeLessThan(4);
  });

  it('honours a caller-provided mask for a variable region', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      ...base,
      sink,
      mask: (system) => system.replace(/Tenant: \w+/g, 'Tenant: <id>'),
    });
    for (const tenant of ['acme', 'globex', 'initech', 'umbrella']) {
      auditor.observe({ model: 'claude-sonnet-5', system: `You are helpful.\nTenant: ${tenant}\nBe brief.` });
    }
    const shapeKeys = new Set(events.filter((e) => e.kind === 'analysis').map((e) => e.shapeKey));
    expect(shapeKeys.size).toBe(1);
  });
});
