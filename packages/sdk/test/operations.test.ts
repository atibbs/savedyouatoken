import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { callbackHealthDestination } from '../src/sinks';
import type { AuditEvent, HealthEvent } from '../src/types';
import {
  FIXED_WORKLOAD,
  anthropicRequest,
  collectingSink,
  flushMacrotasks,
  testCounter,
} from './helpers';

const configured = {
  workflow: {
    name: 'Support triage',
    environment: 'production',
    service: 'support-api',
    tags: { owner: 'cx-platform', region: 'us-west-2' },
  },
  release: {
    version: '2.4.0',
    commit: 'abc123',
    deployment: 'deploy-42',
    deployedAt: '2026-08-14T00:00:00.000Z',
  },
} as const;

describe('operational identity and metadata', () => {
  it('generates a stable prompt-independent workflow id and attaches release provenance', () => {
    const first = collectingSink();
    const second = collectingSink();
    createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink: first.sink, operations: configured,
    }).observe(anthropicRequest({ system: 'First completely different prompt.' }));
    createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink: second.sink, operations: configured,
    }).observe(anthropicRequest({ system: 'Second unrelated prompt with different contents.' }));

    const a = first.events.find((event) => event.kind === 'analysis');
    const b = second.events.find((event) => event.kind === 'analysis');
    expect(a?.kind === 'analysis' && b?.kind === 'analysis').toBe(true);
    if (a?.kind !== 'analysis' || b?.kind !== 'analysis') return;
    expect(a.operations.workflow.id).toBe(b.operations.workflow.id);
    expect(a.operations.workflow.id).toMatch(/^wf_[a-f0-9]{8}$/);
    expect(a.operations.workflow).toMatchObject({
      name: 'Support triage', environment: 'production', service: 'support-api',
    });
    expect(a.operations.release).toEqual(configured.release);
    expect(a.portableReport.workflow).toEqual({ id: a.operations.workflow.id, environment: 'production' });
    expect(a.portableReport.release).toEqual({ id: 'deploy-42', deployedAt: configured.release.deployedAt });
    expect(a.operations.comparison).toMatchObject({
      contractVersion: a.portableReport.contract.version,
      engineVersion: a.portableReport.catalogue.engineVersion,
      rulesetId: a.portableReport.catalogue.rulesetId,
      modelCatalogueDate: a.portableReport.catalogue.modelCatalogueDate,
    });
  });

  it('bounds metadata, omits rejected values, and reports only field names and reason codes', async () => {
    const health: HealthEvent[] = [];
    const { events, sink } = collectingSink();
    const tags = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`tag-${index}`, `value-${index}`]));
    tags['bad key'] = 'never emitted';
    const rejectedCanary = 'REJECTED_METADATA_CANARY_'.repeat(20);
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink,
      operations: {
        workflow: { name: 'Bounded workflow', environment: rejectedCanary, tags },
        release: { commit: rejectedCanary },
        health: callbackHealthDestination((event) => health.push(event)),
      },
    });
    auditor.observe(anthropicRequest());
    await flushMacrotasks();

    const report = events.find((event) => event.kind === 'analysis');
    expect(report?.kind).toBe('analysis');
    if (report?.kind !== 'analysis') return;
    expect(report.operations.workflow).not.toHaveProperty('environment');
    expect(report.operations.release).not.toHaveProperty('commit');
    expect(Object.keys(report.operations.workflow.tags ?? {})).toHaveLength(10);
    expect(JSON.stringify(report.operations)).not.toContain(rejectedCanary);
    const initialization = health.find((event) => event.kind === 'initialization');
    expect(initialization).toMatchObject({
      kind: 'initialization',
      metadataRejected: expect.arrayContaining([
        { field: 'workflow.environment', reason: 'too-long' },
        { field: 'release.commit', reason: 'too-long' },
        { field: 'workflow.tags', reason: 'too-many-tags' },
      ]),
    });
    expect(JSON.stringify(health)).not.toContain(rejectedCanary);
  });

  it('keeps the deprecated reportContext path stable and prompt-independent', () => {
    const events: AuditEvent[] = [];
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: { emit: (event) => { events.push(event); } },
      reportContext: { workflowId: 'legacy/support', environment: 'staging', releaseId: 'old-release' },
    });
    auditor.observe(anthropicRequest({ system: 'one' }));
    auditor.observe(anthropicRequest({ system: 'two' }));
    const analyses = events.filter((event) => event.kind === 'analysis');
    expect(new Set(analyses.map((event) => event.operations.workflow.id))).toEqual(new Set(['legacy/support']));
    expect(analyses[0]?.operations.configurationMode).toBe('legacy');
  });

  it('falls back to legacy workflow identity as a unit when the configured name is invalid', async () => {
    const health: HealthEvent[] = [];
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink,
      reportContext: { workflowId: 'legacy/support', environment: 'staging', releaseId: 'legacy-release' },
      operations: {
        workflow: {
          name: '', id: 'configured/id', environment: 'production', service: 'configured-service',
          tags: { owner: 'configured-owner' },
        },
        health: callbackHealthDestination((event) => health.push(event)),
      },
    });
    auditor.observe(anthropicRequest());
    await flushMacrotasks();
    const report = events.find((event) => event.kind === 'analysis');
    expect(report?.kind).toBe('analysis');
    if (report?.kind !== 'analysis') return;
    expect(report.operations).toMatchObject({
      configurationMode: 'legacy',
      workflow: { id: 'legacy/support', name: 'legacy/support', environment: 'staging' },
    });
    expect(report.operations.workflow).not.toHaveProperty('service');
    expect(report.operations.workflow).not.toHaveProperty('tags');
    expect(report.portableReport.workflow).toEqual({ id: 'legacy/support', environment: 'staging' });
    expect(health.find((event) => event.kind === 'initialization')).toMatchObject({
      metadataRejected: expect.arrayContaining([{ field: 'workflow.name', reason: 'missing' }]),
    });
  });

  it('distinguishes invalid metadata types from missing values', async () => {
    const health: HealthEvent[] = [];
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink,
      operations: {
        workflow: { name: 'Runtime validation', environment: 42 as unknown as string },
        health: callbackHealthDestination((event) => health.push(event)),
      },
    });
    auditor.observe(anthropicRequest());
    await flushMacrotasks();
    const report = events.find((event) => event.kind === 'analysis');
    expect(report?.operations.workflow).not.toHaveProperty('environment');
    expect(health.find((event) => event.kind === 'initialization')).toMatchObject({
      metadataRejected: expect.arrayContaining([
        { field: 'workflow.environment', reason: 'invalid-type' },
      ]),
    });
  });

  it('enforces the serialized tag payload limit', async () => {
    const health: HealthEvent[] = [];
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink,
      operations: {
        workflow: {
          name: 'Tag bytes',
          tags: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`key-${index}`, 'x'.repeat(120)])),
        },
        health: callbackHealthDestination((event) => health.push(event)),
      },
    });
    auditor.observe(anthropicRequest());
    await flushMacrotasks();
    const report = events.find((event) => event.kind === 'analysis');
    expect(report?.kind).toBe('analysis');
    if (report?.kind !== 'analysis') return;
    const bytes = new TextEncoder().encode(JSON.stringify(report.operations.workflow.tags)).byteLength;
    expect(bytes).toBeLessThanOrEqual(1024);
    expect(health.find((event) => event.kind === 'initialization')).toMatchObject({
      metadataRejected: expect.arrayContaining([{ field: 'workflow.tags', reason: 'tag-payload-too-large' }]),
    });
  });
});

describe('maturity and prompt-safe diagnostics', () => {
  it('reports provisional reasons and emits a mature transition for an unchanged shape', () => {
    let clock = 1_000_000;
    const { events, sink } = collectingSink();
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      sink,
      now: () => clock,
      operations: {
        workflow: { name: 'Maturity test' },
        maturity: { minObservations: 3, minWindowMs: 1000, minTrafficStability: 0.5 },
      },
    });
    for (let index = 0; index < 3; index++) {
      auditor.observe(anthropicRequest(), { usage: { output_tokens: 200 } });
      clock += 500;
    }
    const analyses = events.filter((event) => event.kind === 'analysis');
    expect(analyses.length).toBeGreaterThanOrEqual(2);
    expect(analyses[0]?.maturity).toMatchObject({
      state: 'provisional',
      reasons: expect.arrayContaining(['insufficient-observations', 'insufficient-window', 'unstable-traffic']),
    });
    expect(analyses.at(-1)?.maturity).toMatchObject({ state: 'mature', reasons: [], progress: { overall: 1 } });
    expect(new Set(analyses.map((event) => event.shapeKey)).size).toBe(1);
  });

  it('diagnoses churn with hashes/counts/positions and quantifies mask effectiveness', async () => {
    const health: HealthEvent[] = [];
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: { emit() {} },
      mask: (system) => system.replace(/Tenant: (acme|globex)/, 'Tenant: <masked>'),
      operations: {
        workflow: { name: 'Churn test' },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 0,
        diagnostics: { minObservations: 6, minUniqueShapes: 5, churnRatio: 0.8 },
      },
    });
    for (const value of ['acme', 'globex', 'initech', 'umbrella', 'hooli', 'massive']) {
      auditor.observe({ model: 'claude-sonnet-5', system: `Static line\nTenant: ${value}\nEnd` });
    }
    await flushMacrotasks();
    const churn = health.find((event) => event.kind === 'shape-churn');
    expect(churn?.kind).toBe('shape-churn');
    if (churn?.kind !== 'shape-churn') return;
    expect(churn.diagnostic).toMatchObject({
      classification: 'excessive-shape-churn',
      observations: 6,
      uniqueShapes: 5,
      rawUniqueShapes: 6,
      maskConfigured: true,
    });
    expect(churn.diagnostic.maskCollapseRatio).toBeGreaterThan(0);
    expect(churn.diagnostic.variableLinePositions).toContain(1);
    expect(JSON.stringify(churn)).not.toContain('acme');
    expect(JSON.stringify(churn)).not.toContain('globex');
  });
});
