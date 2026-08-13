import { describe, expect, it } from 'vitest';
import { analyze } from '@savedyouatoken/core';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { collectingSink, testCounter, FIXED_WORKLOAD, anthropicRequest } from './helpers';

describe('deterministic parity with the analyser', () => {
  it('yields the same findings, counts and cost as calling core analyze directly', () => {
    const counter = testCounter();
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { counter, workload: FIXED_WORKLOAD, sink });

    const req = anthropicRequest();
    auditor.observe(req, { usage: { output_tokens: 400 } });

    const sdkEvent = events.find((e) => e.kind === 'analysis');
    expect(sdkEvent?.kind).toBe('analysis');
    if (sdkEvent?.kind !== 'analysis') return;

    const direct = analyze({
      prompt: req.system,
      toolsSource: JSON.stringify(req.tools),
      modelId: 'claude-sonnet-5',
      workload: FIXED_WORKLOAD,
      counter,
    });

    const sdk = sdkEvent.result;
    expect(sdk.inputTokens).toBe(direct.inputTokens);
    expect(sdk.promptTokens).toBe(direct.promptTokens);
    expect(sdk.toolTokens).toBe(direct.toolTokens);
    expect(sdk.tokensRemoved).toBe(direct.tokensRemoved);
    expect(sdk.costNow.perMonth).toBe(direct.costNow.perMonth);
    expect(sdk.findings.map((f) => [f.ruleId, f.tokensSaved, f.monthlySaving])).toEqual(
      direct.findings.map((f) => [f.ruleId, f.tokensSaved, f.monthlySaving]),
    );
  });
});
