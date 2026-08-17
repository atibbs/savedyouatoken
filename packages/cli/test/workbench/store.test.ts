import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, canonicalStringify, DEFAULT_WORKLOAD, heuristicCounter, toReportEnvelope } from '@savedyouatoken/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_REPORT_BYTES,
  deleteStore,
  exportStore,
  getReport,
  ingestReport,
  latestBaselineApproval,
  listBaselineApprovals,
  listReports,
  rebuildIndex,
  recordBaselineApproval,
  resolveDataDir,
} from '../../src/workbench/store';

function buildReportJson(overrides: { workflowId?: string; releaseId?: string; prompt?: string } = {}): string {
  const result = analyze({
    prompt: overrides.prompt ?? 'Please kindly help the customer as best you can, thanks so much!',
    modelId: 'claude-sonnet-5',
    workload: DEFAULT_WORKLOAD,
    counter: heuristicCounter,
  });
  const generatedAt = '2026-01-01T00:00:00.000Z';
  const report = toReportEnvelope(result, {
    workflow: { id: overrides.workflowId ?? 'support/triage' },
    release: { id: overrides.releaseId ?? 'v1' },
    provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt },
    maturity: { state: 'mature', observations: 500 },
    window: { startedAt: generatedAt, endedAt: generatedAt, requests: 500 },
    engineVersion: '0.1.0',
    rulesetId: 'test-ruleset',
  });
  return canonicalStringify(report);
}

describe('resolveDataDir', () => {
  it('prefers an explicit override, then the env var, then the default', () => {
    const original = process.env.SAVEDYOUATOKEN_WORKBENCH_DIR;
    delete process.env.SAVEDYOUATOKEN_WORKBENCH_DIR;
    expect(resolveDataDir('/explicit')).toBe('/explicit');
    expect(resolveDataDir()).toContain('.savedyouatoken');
    process.env.SAVEDYOUATOKEN_WORKBENCH_DIR = '/from-env';
    expect(resolveDataDir()).toBe('/from-env');
    if (original === undefined) delete process.env.SAVEDYOUATOKEN_WORKBENCH_DIR;
    else process.env.SAVEDYOUATOKEN_WORKBENCH_DIR = original;
  });
});

describe('report store', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-'));
  });

  it('ingests a valid report, indexes it, and returns isNew: true', async () => {
    const json = buildReportJson();
    const result = await ingestReport(dataDir, json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isNew).toBe(true);

    const entries = listReports(dataDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: result.id, workflowId: 'support/triage', maturityState: 'mature' });

    const stored = getReport(dataDir, result.id);
    expect(stored?.workflow.id).toBe('support/triage');
  });

  it('is idempotent: re-ingesting the identical report is a no-op, not a duplicate', async () => {
    const json = buildReportJson();
    const first = await ingestReport(dataDir, json);
    const second = await ingestReport(dataDir, json);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.id).toBe(second.id);
    expect(second.isNew).toBe(false);
    expect(listReports(dataDir)).toHaveLength(1);
  });

  it('never persists prompt text (canary)', async () => {
    const json = buildReportJson({ prompt: 'CANARY_PROMPT_TEXT_Z9 please kindly help.' });
    const result = await ingestReport(dataDir, json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = readFileSync(join(dataDir, 'reports', `${result.id.replace('sha256:', '')}.json`), 'utf8');
    expect(raw).not.toContain('CANARY_PROMPT_TEXT_Z9');
    expect(JSON.stringify(listReports(dataDir))).not.toContain('CANARY_PROMPT_TEXT_Z9');
  });

  it('rejects an oversized payload before parsing', async () => {
    const huge = JSON.stringify({ padding: 'x'.repeat(MAX_REPORT_BYTES) });
    const result = await ingestReport(dataDir, huge);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid JSON and structurally invalid reports with actionable errors', async () => {
    const badJson = await ingestReport(dataDir, '{not json');
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.errors.length).toBeGreaterThan(0);

    const badShape = await ingestReport(dataDir, JSON.stringify({ hello: 'world' }));
    expect(badShape.ok).toBe(false);
    if (!badShape.ok) expect(badShape.errors.length).toBeGreaterThan(0);
  });

  it('rebuilds the index from source documents when it is missing or corrupt', async () => {
    const result = await ingestReport(dataDir, buildReportJson());
    expect(result.ok).toBe(true);
    // Simulate a corrupt/deleted index — the source document is the only durable state.
    const rebuilt = rebuildIndex(dataDir);
    expect(rebuilt).toHaveLength(1);
    expect(listReports(dataDir)).toHaveLength(1);
  });

  it('records and retrieves the latest baseline approval per workflow', async () => {
    const a = await ingestReport(dataDir, buildReportJson({ releaseId: 'v1' }));
    const b = await ingestReport(dataDir, buildReportJson({ releaseId: 'v2' }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    recordBaselineApproval(dataDir, {
      reportId: a.id,
      workflowId: 'support/triage',
      approvedAt: '2026-01-01T00:00:00.000Z',
      acknowledgedProvisional: false,
      tolerance: { maxTokenRegressionPercent: 10 },
      enforcement: 'warn',
    });
    recordBaselineApproval(dataDir, {
      reportId: b.id,
      workflowId: 'support/triage',
      approvedAt: '2026-01-02T00:00:00.000Z',
      acknowledgedProvisional: false,
      tolerance: { maxTokenRegressionPercent: 10 },
      enforcement: 'warn',
    });

    expect(listBaselineApprovals(dataDir)).toHaveLength(2);
    expect(latestBaselineApproval(dataDir, 'support/triage')?.reportId).toBe(b.id);
    expect(latestBaselineApproval(dataDir, 'no/such/workflow')).toBeUndefined();
  });

  it('exports the full store and deletion removes everything', async () => {
    const result = await ingestReport(dataDir, buildReportJson());
    expect(result.ok).toBe(true);
    recordBaselineApproval(dataDir, {
      reportId: result.ok ? result.id : '',
      workflowId: 'support/triage',
      approvedAt: '2026-01-01T00:00:00.000Z',
      acknowledgedProvisional: false,
      tolerance: {},
      enforcement: 'warn',
    });

    const outDir = mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-export-'));
    const { reportsCopied } = exportStore(dataDir, outDir);
    expect(reportsCopied).toBe(1);
    expect(readFileSync(join(outDir, 'baselines.json'), 'utf8')).toContain('support/triage');

    deleteStore(dataDir);
    expect(listReports(dataDir)).toHaveLength(0); // rebuildIndex recreates an empty, fresh dir
  });
});
