import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { callbackHealthDestination, dashboardSink, fileSink } from '../src/sinks';
import type { HealthEvent } from '../src/types';
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
    const portable = JSON.stringify(event.portableReport);
    for (const canary of canaryValues) expect(portable).not.toContain(canary);
    expect(event.portableReport.contract).toEqual({ kind: 'report', version: { major: 1, minor: 1 } });
    expect(event.portableReport.maturity).toMatchObject({ state: 'mature' });
  });

  it('attaches caller workflow and release identity without changing the legacy report', () => {
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink,
      reportContext: {
        workflowId: 'support/triage',
        environment: 'production',
        releaseId: 'abc123',
      },
    });
    auditor.observe(cannedRequest());
    const event = events.find((candidate) => candidate.kind === 'analysis');
    expect(event?.kind).toBe('analysis');
    if (event?.kind !== 'analysis') return;
    expect(event.report).toHaveProperty('v', 2);
    expect(event.portableReport.workflow).toEqual({ id: 'support/triage', environment: 'production' });
    expect(event.portableReport.release).toEqual({ id: 'abc123' });
  });

  it('keeps every captured-content canary out of operational metadata and health events', async () => {
    const health: HealthEvent[] = [];
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink,
      operations: {
        workflow: {
          name: 'Privacy workflow', id: 'privacy/workflow', environment: 'production',
          service: 'privacy-service', tags: { owner: 'security', region: 'test' },
        },
        release: {
          version: '1.2.3', commit: 'abc123', deployment: 'deploy-7',
          deployedAt: '2026-08-14T00:00:00.000Z',
        },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 0,
      },
    });
    auditor.observe(cannedRequest());
    await flushMacrotasks();
    await flushMacrotasks();
    const event = events.find((candidate) => candidate.kind === 'analysis');
    expect(event?.kind).toBe('analysis');
    if (event?.kind !== 'analysis') return;
    expect(event.operations).toMatchObject({
      workflow: { id: 'privacy/workflow', name: 'Privacy workflow', environment: 'production' },
      release: { version: '1.2.3', commit: 'abc123', deployment: 'deploy-7' },
    });
    for (const canary of canaryValues) {
      expect(JSON.stringify(event.operations)).not.toContain(canary);
      expect(JSON.stringify(event.maturity)).not.toContain(canary);
      expect(JSON.stringify(health)).not.toContain(canary);
    }
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

  it('writes only prompt-free report and operational projections to the file sink', () => {
    const directory = mkdtempSync(join(tmpdir(), 'syat-privacy-'));
    const path = join(directory, 'audit.jsonl');
    try {
      const auditor = createAuditor(anthropicAdapter, {
        counter: testCounter(),
        workload: FIXED_WORKLOAD,
        sink: fileSink(path),
        operations: { workflow: { name: 'File privacy' } },
      });
      auditor.observe(cannedRequest());
      const contents = readFileSync(path, 'utf8');
      for (const canary of canaryValues) expect(contents).not.toContain(canary);
      expect(contents).toContain('portableReport');
      expect(contents).toContain('operations');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
