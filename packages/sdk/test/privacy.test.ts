import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { dashboardSink } from '../src/sinks';
import { collectingSink, testCounter, FIXED_WORKLOAD, flushMacrotasks } from './helpers';

// Unique strings planted in the prompt, a tool name, a tool description, and a schema field.
const CANARIES = {
  prompt: 'CANARYPROMPT_a1b2c3',
  toolName: 'canary_tool_name_d4e5f6',
  toolDesc: 'CANARYDESC_g7h8i9',
  schemaField: 'canary_schema_field_j0k1l2',
};

function cannedRequest() {
  return {
    model: 'claude-sonnet-5',
    system: `You are helpful. Please be very very thorough. ${CANARIES.prompt}`,
    tools: [
      {
        name: CANARIES.toolName,
        description: CANARIES.toolDesc,
        input_schema: {
          type: 'object',
          properties: { [CANARIES.schemaField]: { type: 'string' } },
          required: [CANARIES.schemaField],
        },
      },
    ],
  };
}

const canaryValues = Object.values(CANARIES);

describe('prompt privacy by default', () => {
  it('keeps every canary out of the redacted report', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, { counter: testCounter(), workload: FIXED_WORKLOAD, sink });
    auditor.observe(cannedRequest());

    const event = events.find((e) => e.kind === 'analysis');
    expect(event?.kind).toBe('analysis');
    if (event?.kind !== 'analysis') return;

    const serialised = JSON.stringify(event.report);
    for (const canary of canaryValues) expect(serialised).not.toContain(canary);
  });

  it('transmits only a prompt-free payload to a network destination', async () => {
    const bodies: string[] = [];
    const fakeFetch: typeof fetch = async (_url, init) => {
      bodies.push(String(init?.body ?? ''));
      return new Response('{}', { status: 200 });
    };

    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: dashboardSink({ url: 'https://example.test/ingest', fetchImpl: fakeFetch }),
    });
    auditor.observe(cannedRequest());
    await flushMacrotasks();

    expect(bodies).toHaveLength(1);
    for (const canary of canaryValues) expect(bodies[0]!).not.toContain(canary);
    // It should still carry the useful, prompt-free signal.
    expect(bodies[0]!).toContain('modelId');
  });
});
