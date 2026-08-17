import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTRACT_VERSION,
  analyze,
  contentIdentity,
  heuristicCounter,
  toReportEnvelope,
  DEFAULT_WORKLOAD,
  type BaselineDocument,
} from '@savedyouatoken/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASELINE_BUNDLE_SCHEMA, BASELINE_BUNDLE_VERSION, readBaselineBundle, writeBaselineBundle } from '../src/contracts-io';

function buildReport() {
  const result = analyze({
    prompt: 'Please kindly help the customer as best you can, thanks so much!',
    modelId: 'claude-sonnet-5',
    workload: DEFAULT_WORKLOAD,
    counter: heuristicCounter,
  });
  const generatedAt = '2026-01-01T00:00:00.000Z';
  return toReportEnvelope(result, {
    workflow: { id: 'support/triage' },
    release: { id: 'v1' },
    provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt },
    maturity: { state: 'provisional', observations: 1 },
    window: { startedAt: generatedAt, endedAt: generatedAt, requests: 1 },
    engineVersion: '0.1.0',
    rulesetId: 'test-ruleset',
  });
}

describe('baseline bundle round trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'savedyouatoken-baseline-'));
  const path = join(dir, 'baseline.json');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes and re-reads an identical, integrity-checked bundle', async () => {
    const report = buildReport();
    const reportId = await contentIdentity(report);
    const baseline: BaselineDocument = {
      contract: { kind: 'baseline', version: { ...CONTRACT_VERSION } },
      provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt: '2026-01-01T00:00:00.000Z' },
      reportId,
      workflow: report.workflow,
      release: report.release,
    };

    await writeBaselineBundle(path, {
      schema: BASELINE_BUNDLE_SCHEMA,
      version: { ...BASELINE_BUNDLE_VERSION },
      baseline,
      report,
      sources: ['fixtures/prompt.txt'],
    });

    const bundle = await readBaselineBundle(path);
    expect(bundle.baseline.reportId).toBe(reportId);
    expect(bundle.report).toEqual(report);
    expect(bundle.sources).toEqual(['fixtures/prompt.txt']);
  });

  it('never carries prompt text on disk (canary)', async () => {
    const raw = readFileSync(path, 'utf8');
    expect(raw).not.toContain('customer');
    expect(raw).not.toContain('kindly');
  });

  it('rejects a bundle whose report was hand-edited after content identity was computed', async () => {
    const report = buildReport();
    const reportId = await contentIdentity(report);
    const baseline: BaselineDocument = {
      contract: { kind: 'baseline', version: { ...CONTRACT_VERSION } },
      provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt: '2026-01-01T00:00:00.000Z' },
      reportId,
      workflow: report.workflow,
      release: report.release,
    };
    const tamperedPath = join(dir, 'tampered.json');
    await writeBaselineBundle(tamperedPath, {
      schema: BASELINE_BUNDLE_SCHEMA,
      version: { ...BASELINE_BUNDLE_VERSION },
      baseline,
      report: { ...report, analysis: { ...report.analysis, inputTokens: 999999 } },
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(readBaselineBundle(tamperedPath)).rejects.toThrow('process.exit(2)');
    expect(errSpy.mock.calls.join('\n')).toContain('corrupt or was hand-edited');
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('rejects a bundle with an unsupported (or missing) major version instead of misreading it', async () => {
    const report = buildReport();
    const reportId = await contentIdentity(report);
    const baseline: BaselineDocument = {
      contract: { kind: 'baseline', version: { ...CONTRACT_VERSION } },
      provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt: '2026-01-01T00:00:00.000Z' },
      reportId,
      workflow: report.workflow,
      release: report.release,
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const futureMajorPath = join(dir, 'future-major.json');
    await writeBaselineBundle(futureMajorPath, {
      schema: BASELINE_BUNDLE_SCHEMA,
      version: { major: BASELINE_BUNDLE_VERSION.major + 1, minor: 0 },
      baseline,
      report,
    });
    await expect(readBaselineBundle(futureMajorPath)).rejects.toThrow('process.exit(2)');
    expect(errSpy.mock.calls.join('\n')).toContain('unsupported baseline-bundle version');

    const missingVersionPath = join(dir, 'missing-version.json');
    const raw = JSON.parse(readFileSync(futureMajorPath, 'utf8'));
    delete raw.version;
    // writeBaselineBundle only accepts a well-typed BaselineBundle; write the malformed JSON
    // directly to simulate a hand-edited or pre-versioning file.
    const { writeFileSync } = await import('node:fs');
    writeFileSync(missingVersionPath, JSON.stringify(raw));
    await expect(readBaselineBundle(missingVersionPath)).rejects.toThrow('process.exit(2)');

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});
