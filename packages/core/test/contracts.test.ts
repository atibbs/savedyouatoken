import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze';
import {
  CONTRACT_MINOR,
  canonicalStringify,
  classifyReportCompatibility,
  contentIdentity,
  evaluatePolicy,
  parseBaselineDocument,
  parseContractDocument,
  parsePolicyDocument,
  parseReportEnvelope,
  requireReportEnvelope,
  toReportEnvelope,
  type PolicyDocument,
  type ReportEnvelope,
} from '../src/contracts';
import { DEFAULT_WORKLOAD } from '../src/cost';
import { heuristicCounter } from '../src/tokens';

const fixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../contracts/fixtures/${name}`, import.meta.url), 'utf8')) as T;
const schema = (name: string) =>
  JSON.parse(readFileSync(new URL(`../contracts/schemas/${name}`, import.meta.url), 'utf8'));

describe('contract parsing and migration', () => {
  it('parses current documents and ignores unknown optional fields in the supported major', () => {
    expect(parseReportEnvelope(fixture('report-v1.1.valid.json')).ok).toBe(true);
    expect(parseBaselineDocument(fixture('baseline-v1.1.valid.json')).ok).toBe(true);
    expect(parsePolicyDocument(fixture('policy-v1.1.valid.json')).ok).toBe(true);

    const forward = parseReportEnvelope(fixture('report-forward.valid.json'));
    expect(forward.ok).toBe(true);
    if (forward.ok) {
      expect(forward.value.contract.version.minor).toBe(2);
      expect(forward.value).not.toHaveProperty('futureTopLevelField');
      expect(forward.value.analysis).not.toHaveProperty('futureAnalysisField');
    }
  });

  it('rejects malformed fields and unknown major versions with structured locations', () => {
    const invalid = parseReportEnvelope(fixture('report-invalid.json'));
    expect(invalid).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'required', path: '$.catalogue.currency' }),
      ]),
    });

    const unknown = fixture<Record<string, any>>('report-v1.1.valid.json');
    unknown.contract.version.major = 2;
    const parsed = parseReportEnvelope(unknown);
    expect(parsed).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_major', path: '$.contract.version.major' }),
      ]),
    });
  });

  it.each([
    ['report-v1.0.migration.json', parseReportEnvelope],
    ['baseline-v1.0.migration.json', parseBaselineDocument],
    ['policy-v1.0.migration.json', parsePolicyDocument],
  ] as const)('migrates %s and retains source version and producer provenance', (name, parse) => {
    const source = fixture<Record<string, any>>(name);
    const parsed = parse(source) as ReturnType<typeof parseReportEnvelope>;
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.contract.version.minor).toBe(CONTRACT_MINOR);
    expect(parsed.value.provenance.producer).toBe(source.provenance.producer);
    expect(parsed.value.provenance.sourceContractVersion).toEqual({ major: 1, minor: 0 });
  });
});

describe('JSON Schema conformance', () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validateReport = ajv.compile(schema('report.schema.json'));
  const validateBaseline = ajv.compile(schema('baseline.schema.json'));
  const validatePolicy = ajv.compile(schema('policy.schema.json'));

  it.each([
    ['report-v1.1.valid.json', validateReport],
    ['report-v1.0.migration.json', validateReport],
    ['report-forward.valid.json', validateReport],
    ['baseline-v1.1.valid.json', validateBaseline],
    ['baseline-v1.0.migration.json', validateBaseline],
    ['policy-v1.1.valid.json', validatePolicy],
    ['policy-v1.0.migration.json', validatePolicy],
  ])('validates %s against its published schema', (name, validate) => {
    expect(validate(fixture(name)), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects the invalid report fixture in both schema and runtime validator', () => {
    const value = fixture('report-invalid.json');
    expect(validateReport(value)).toBe(false);
    expect(parseReportEnvelope(value).ok).toBe(false);
  });

  it.each([
    ['report-v1.1.valid.json', validateReport, parseReportEnvelope],
    ['baseline-v1.1.valid.json', validateBaseline, parseBaselineDocument],
    ['policy-v1.1.valid.json', validatePolicy, parsePolicyDocument],
  ] as const)('rejects a malformed source version in %s in both schema and runtime validator',
    (name, validate, parse) => {
      const value = fixture<Record<string, any>>(name);
      value.provenance.sourceContractVersion = { major: 1 };
      expect(validate(value)).toBe(false);
      expect(parse(value).ok).toBe(false);
    });
});

describe('canonical identity and compatibility', () => {
  it('normalizes key order, Unicode strings, numeric representations, and unknown fields', async () => {
    const base = fixture<ReportEnvelope>('report-v1.1.valid.json');
    const equivalent = JSON.parse(JSON.stringify(base)) as Record<string, any>;
    equivalent.future = 'ignored';
    equivalent.workflow = { environment: 'produc\u0074ion', id: 'support/tria\u0067e' };
    equivalent.analysis.monthlyNow = 420.5000;
    equivalent.analysis.cacheSaving = -0;
    const normalizedBase = JSON.parse(JSON.stringify(base)) as ReportEnvelope;
    normalizedBase.analysis.cacheSaving = 0;

    const parsedEquivalent = requireReportEnvelope(equivalent);
    const parsedBase = requireReportEnvelope(normalizedBase);
    expect(canonicalStringify(parsedEquivalent)).toBe(
      canonicalStringify(parsedBase),
    );
    expect(await contentIdentity(parsedEquivalent)).toBe(
      await contentIdentity(parsedBase),
    );
  });

  it.each(['report', 'baseline', 'policy'] as const)(
    'matches the published %s canonical byte and SHA-256 vectors',
    async (kind) => {
    const parsed = parseContractDocument(fixture(`${kind}-v1.1.valid.json`));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const canonical = readFileSync(
      new URL(`../contracts/vectors/${kind}-v1.1.canonical.json`, import.meta.url),
      'utf8',
    ).trimEnd();
    const identity = readFileSync(
      new URL(`../contracts/vectors/${kind}-v1.1.sha256`, import.meta.url),
      'utf8',
    ).trim();
    expect(canonicalStringify(parsed.value)).toBe(canonical);
    expect(await contentIdentity(parsed.value)).toBe(identity);
  });

  it('classifies exact, approximate, and invalid comparisons', () => {
    const report = parseReportEnvelope(fixture('report-v1.1.valid.json'));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(classifyReportCompatibility(report.value, structuredClone(report.value)).status).toBe('exact');

    const approximate = structuredClone(report.value);
    approximate.catalogue.modelCatalogueDate = '2026-08-11';
    expect(classifyReportCompatibility(report.value, approximate)).toMatchObject({ status: 'approximate' });

    const invalid = structuredClone(report.value);
    invalid.workflow.id = 'another/workflow';
    expect(classifyReportCompatibility(report.value, invalid)).toMatchObject({ status: 'invalid' });
  });

  it('evaluates absolute and baseline-relative policies deterministically', () => {
    const parsedReport = parseReportEnvelope(fixture('report-v1.1.valid.json'));
    const parsedPolicy = parsePolicyDocument(fixture('policy-v1.1.valid.json'));
    expect(parsedReport.ok && parsedPolicy.ok).toBe(true);
    if (!parsedReport.ok || !parsedPolicy.ok) return;
    const baseline = structuredClone(parsedReport.value);
    baseline.analysis.inputTokens = 1000;
    baseline.analysis.monthlyNow = 350;
    expect(evaluatePolicy(parsedPolicy.value, parsedReport.value, baseline)).toMatchObject({
      outcome: 'fail',
      breaches: expect.arrayContaining([expect.objectContaining({ budget: 'maxTokenRegressionPercent' })]),
    });
  });

  it('rejects a compatible baseline whose identity does not match policy.baselineId', () => {
    const parsedReport = parseReportEnvelope(fixture('report-v1.1.valid.json'));
    const parsedPolicy = parsePolicyDocument(fixture('policy-v1.1.valid.json'));
    expect(parsedReport.ok && parsedPolicy.ok).toBe(true);
    if (!parsedReport.ok || !parsedPolicy.ok) return;
    const baseline = structuredClone(parsedReport.value);
    // Compatible (same workflow/currency/model as the report) but not the specific baseline
    // policy.baselineId ("sha256:aaa...") points to.
    const wrongBaselineId = `sha256:${'b'.repeat(64)}`;
    expect(() => evaluatePolicy(parsedPolicy.value, parsedReport.value, baseline, wrongBaselineId)).toThrow(
      /does not match the baseline this policy was generated against/,
    );
    // Omitting the identity argument entirely preserves prior behavior (no check performed).
    expect(() => evaluatePolicy(parsedPolicy.value, parsedReport.value, baseline)).not.toThrow();
    // The correct identity passes.
    expect(() =>
      evaluatePolicy(parsedPolicy.value, parsedReport.value, baseline, parsedPolicy.value.baselineId),
    ).not.toThrow();
  });
});

describe('portable report privacy', () => {
  it('excludes prompt, tool, schema, and content-derived finding canaries from canonical bytes', () => {
    const canaries = ['CANARY_PROMPT', 'CANARY_TOOL', 'CANARY_DESCRIPTION', 'CANARY_SCHEMA'];
    const result = analyze({
      prompt: `Please be very very thorough. ${canaries[0]}`,
      toolsSource: JSON.stringify([{ type: 'function', function: {
        name: canaries[1],
        description: `${canaries[2]} ${'long tool description '.repeat(30)}`,
        parameters: { type: 'object', properties: { [canaries[3]!]: { type: 'string' } } },
      } }]),
      modelId: 'claude-opus-5',
      workload: DEFAULT_WORKLOAD,
      counter: heuristicCounter,
    });
    const report = toReportEnvelope(result, {
      workflow: { id: 'privacy/test' },
      release: { id: 'test' },
      provenance: { producer: 'test', producerVersion: '1', generatedAt: '2026-08-13T00:00:00.000Z' },
      maturity: { state: 'provisional', observations: 1 },
      window: { startedAt: '2026-08-13T00:00:00.000Z', endedAt: '2026-08-13T00:00:00.000Z', requests: 1 },
      engineVersion: 'test',
      rulesetId: 'test',
    });
    const bytes = canonicalStringify(report);
    for (const canary of canaries) expect(bytes).not.toContain(canary);
    expect(result.findings.some((finding) => canaries.some((canary) => finding.detail.includes(canary)))).toBe(true);
  });
});
