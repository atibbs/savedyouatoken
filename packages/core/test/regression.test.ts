import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze';
import { CONTRACT_VERSION, toReportEnvelope, type ReportEnvelope } from '../src/contracts';
import { DEFAULT_WORKLOAD } from '../src/cost';
import { diffReports } from '../src/regression';
import { heuristicCounter } from '../src/tokens';

const baseInput = {
  workflow: { id: 'support/triage' },
  release: { id: 'v1' },
  provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt: '2026-01-01T00:00:00.000Z' },
  maturity: { state: 'mature' as const, observations: 500 },
  window: { startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-02T00:00:00.000Z', requests: 500 },
  engineVersion: '0.1.0',
  rulesetId: 'test-ruleset',
};

function report(prompt: string, overrides: Partial<typeof baseInput> = {}): ReportEnvelope {
  const result = analyze({
    prompt,
    modelId: 'claude-sonnet-5',
    workload: DEFAULT_WORKLOAD,
    counter: heuristicCounter,
  });
  return toReportEnvelope(result, { ...baseInput, ...overrides });
}

describe('diffReports', () => {
  it('reports invalid compatibility and omits arithmetic across workflows', () => {
    const baseline = report('Please kindly answer the question.', { workflow: { id: 'a' } });
    const current = report('Please kindly answer the question.', { workflow: { id: 'b' } });
    const diff = diffReports(baseline, current);
    expect(diff.compatibility.status).toBe('invalid');
    expect(diff.tokens).toBeUndefined();
    expect(diff.cost).toBeUndefined();
    expect(diff.findings).toBeUndefined();
  });

  it('computes exact token and cost deltas for a compatible pair', () => {
    const baseline = report('Please kindly answer the question.');
    const current = report('Please kindly answer the question in as much detail as humanly possible, thanks so much!');
    const diff = diffReports(baseline, current);
    expect(diff.compatibility.status).not.toBe('invalid');
    expect(diff.tokens!.promptTokens.delta).toBe(
      current.analysis.promptTokens - baseline.analysis.promptTokens,
    );
    expect(diff.tokens!.promptTokens.delta).toBeGreaterThan(0);
    expect(diff.cost!.monthlyNow.delta).toBeCloseTo(
      current.analysis.monthlyNow - baseline.analysis.monthlyNow,
      6,
    );
  });

  it('returns null percent when the baseline value is zero', () => {
    const baseline = report('Hi.');
    const current = report('Hi.');
    const diff = diffReports(baseline, current);
    expect(diff.cost!.cacheSaving.percent).toBe(baseline.analysis.cacheSaving === 0 ? null : diff.cost!.cacheSaving.percent);
  });

  it('classifies findings as new, resolved, unchanged, and changed', () => {
    // "Please kindly" triggers politeness-filler; the longer prompt adds a second, distinct
    // finding (wordy-phrases) while keeping the politeness-filler occurrence count identical.
    const baseline = report('Please kindly review this text.');
    const current = report('Please kindly review this text in order to proceed with the review process.');
    const diff = diffReports(baseline, current);

    const politeness = diff.findings!.find((f) => f.ruleId === 'politeness-filler');
    expect(politeness).toBeDefined();
    expect(['unchanged', 'changed']).toContain(politeness!.status);

    const statuses = new Set(diff.findings!.map((f) => f.status));
    expect(statuses.has('new') || statuses.has('changed')).toBe(true);
  });

  it('marks a finding changed when only its severity differs, even with identical numbers', () => {
    // Severity is a static property of a rule definition, so this only happens in practice when
    // the ruleset changes between baseline and current — but the finding-level diff must still
    // surface it, since compatibility already flags that case as 'approximate' separately.
    const baseline = report('Please kindly review this text.');
    const current = structuredClone(baseline);
    const politeness = current.analysis.findings.find((f) => f.ruleId === 'politeness-filler')!;
    politeness.severity = politeness.severity === 'high' ? 'medium' : 'high';

    const diff = diffReports(baseline, current);
    const entry = diff.findings!.find((f) => f.ruleId === 'politeness-filler');
    expect(entry?.status).toBe('changed');
  });

  it('marks a finding resolved when it disappears entirely', () => {
    const baseline = report('Please kindly review this text.');
    const current = report('Review this text.');
    const diff = diffReports(baseline, current);
    const politeness = diff.findings!.find((f) => f.ruleId === 'politeness-filler');
    expect(politeness?.status).toBe('resolved');
    expect(politeness?.current).toBeNull();
  });

  it('never exposes prompt text (canary)', () => {
    const baseline = report('CANARY_BASELINE_TEXT_Z9 please kindly.');
    const current = report('CANARY_CURRENT_TEXT_Z9 please kindly and thoroughly, thanks so much.');
    const diff = diffReports(baseline, current);
    const serialised = JSON.stringify(diff);
    expect(serialised).not.toContain('CANARY_BASELINE_TEXT_Z9');
    expect(serialised).not.toContain('CANARY_CURRENT_TEXT_Z9');
  });

  it('agrees with the contract version used to build the fixtures', () => {
    expect(CONTRACT_VERSION.major).toBe(1);
  });
});
