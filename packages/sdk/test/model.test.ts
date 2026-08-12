import { describe, expect, it } from 'vitest';
import { normaliseModelId } from '../src/normalise-model';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { collectingSink, testCounter, FIXED_WORKLOAD } from './helpers';

describe('normaliseModelId', () => {
  it('passes a catalogue id through unchanged', () => {
    expect(normaliseModelId('claude-sonnet-5')).toEqual({ raw: 'claude-sonnet-5', modelId: 'claude-sonnet-5' });
  });

  it('strips an 8-digit dated snapshot suffix', () => {
    expect(normaliseModelId('claude-sonnet-5-20260514').modelId).toBe('claude-sonnet-5');
  });

  it('strips a dashed dated snapshot suffix', () => {
    expect(normaliseModelId('claude-opus-4-8-2026-05-14').modelId).toBe('claude-opus-4-8');
  });

  it('resolves a known OpenAI snapshot alias', () => {
    expect(normaliseModelId('gpt-4o-2024-08-06').modelId).toBe('gpt-4o');
  });

  it('maps a dotted provider version to the dashed catalogue id', () => {
    expect(normaliseModelId('gpt-5.5').modelId).toBe('gpt-5-5');
    expect(normaliseModelId('gpt-4.1').modelId).toBe('gpt-4-1');
    expect(normaliseModelId('gemini-2.5-pro').modelId).toBe('gemini-2-5-pro');
  });

  it('maps a dotted version carrying a dated snapshot suffix', () => {
    expect(normaliseModelId('gpt-5.5-2026-01-15').modelId).toBe('gpt-5-5');
  });

  it('returns null for an unmappable identifier', () => {
    expect(normaliseModelId('totally-made-up-model').modelId).toBeNull();
  });
});

describe('unknown model surfacing', () => {
  const base = { counter: testCounter(), workload: FIXED_WORKLOAD };

  it('surfaces an unknown model rather than dropping the audit silently', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { ...base, sink });
    auditor.observe({ model: 'no-such-model-3000', system: 'hi' });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('unknown-model');
    expect(events[0]).toMatchObject({ rawModel: 'no-such-model-3000' });
  });

  it('analyses a dated snapshot against its catalogue model', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { ...base, sink });
    auditor.observe({ model: 'claude-sonnet-5-20260514', system: 'You are helpful.' });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('analysis');
    if (events[0]!.kind === 'analysis') expect(events[0]!.result.model.id).toBe('claude-sonnet-5');
  });
});
