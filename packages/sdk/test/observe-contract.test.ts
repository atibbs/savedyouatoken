import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import type { RequestAdapter } from '../src/types';
import { noopSink } from '../src/sinks';
import { testCounter, FIXED_WORKLOAD } from './helpers';

// The documented manual API `auditor.observe(...)` must never throw, even when a caller-supplied
// adapter/mask misbehaves or a tool object cannot be serialised — the whole capture path is
// guarded, not only the analysis step.
describe('observe() upholds its never-throws contract', () => {
  const base = { counter: testCounter(), workload: FIXED_WORKLOAD, sink: noopSink };

  it('swallows a throwing mask', () => {
    const auditor = createAuditor(anthropicAdapter, {
      ...base,
      mask: () => {
        throw new Error('mask boom');
      },
    });
    expect(() => auditor.observe({ model: 'claude-sonnet-5', system: 'hi' })).not.toThrow();
  });

  it('swallows a circular tool object that JSON.stringify would throw on', () => {
    const auditor = createAuditor(anthropicAdapter, base);
    const circular: Record<string, unknown> = { name: 'tool' };
    circular.self = circular;
    expect(() =>
      auditor.observe({ model: 'claude-sonnet-5', system: 'hi', tools: [circular] }),
    ).not.toThrow();
  });

  it('swallows a throwing custom adapter', () => {
    const badAdapter: RequestAdapter = {
      provider: 'bad',
      extract() {
        throw new Error('adapter boom');
      },
    };
    const auditor = createAuditor(badAdapter, base);
    expect(() => auditor.observe({}, {})).not.toThrow();
  });
});
