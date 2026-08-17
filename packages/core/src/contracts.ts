import type { AnalysisResult } from './analyze';
import { PRICES_VERIFIED_ON } from './models';
import type { Severity } from './types';

export const CONTRACT_MAJOR = 1;
export const CONTRACT_MINOR = 1;
export const CONTRACT_VERSION = { major: CONTRACT_MAJOR, minor: CONTRACT_MINOR } as const;
export const SUPPORTED_CONTRACT_MINORS = [0, 1] as const;
export const CONTRACT_SUPPORT_POLICY = {
  current: CONTRACT_VERSION,
  supportedMajor: CONTRACT_MAJOR,
  oldestSupportedMinor: 0,
  rule: 'Major versions are breaking. Additive optional fields may advance the minor version. Version 1.0 migrates deterministically to 1.1; unknown v1 optional fields are ignored; unknown majors are rejected.',
} as const;
export const ANALYSIS_ENGINE_VERSION = '0.1.0';
export const RULESET_ID = 'savedyouatoken-rules-2026-08-13';

export type ContractKind = 'report' | 'baseline' | 'policy';
export interface ContractVersion { major: number; minor: number }
export interface ContractHeader { kind: ContractKind; version: ContractVersion }
export interface SourceContractVersion extends ContractVersion {}

export interface ContractProvenance {
  producer: string;
  producerVersion: string;
  generatedAt: string;
  sourceContractVersion?: SourceContractVersion;
}

export interface WorkflowIdentity { id: string; environment?: string }
export interface ReleaseIdentity { id: string; deployedAt?: string }
export interface ObservationWindow { startedAt: string; endedAt: string; requests: number }
export interface MeasurementMaturity { state: 'provisional' | 'mature'; observations: number }
export interface CatalogueMetadata {
  engineVersion: string;
  rulesetId: string;
  modelCatalogueDate: string;
  currency: 'USD';
  tokenizer: { family: string; accuracy: 'exact' | 'estimated'; counter: string };
}
export interface PortableWorkload {
  requestsPerDay: number;
  outputTokens: number;
  cacheHitRate: number;
  cacheTtl: '5m' | '1h';
  batch: boolean;
}
export interface PortableFinding {
  ruleId: string;
  severity: Severity;
  occurrences: number;
  tokensSaved: number;
  monthlySaving: number;
}
export interface PortableAnalysis {
  modelId: string;
  promptTokens: number;
  toolTokens: number;
  inputTokens: number;
  optimizedTokens: number;
  monthlyNow: number;
  monthlyAfterRewrite: number;
  cacheSaving: number;
  findings: PortableFinding[];
}

export interface ReportEnvelope {
  contract: ContractHeader & { kind: 'report' };
  workflow: WorkflowIdentity;
  release: ReleaseIdentity;
  provenance: ContractProvenance;
  maturity: MeasurementMaturity;
  window: ObservationWindow;
  catalogue: CatalogueMetadata;
  workload: PortableWorkload;
  analysis: PortableAnalysis;
}

export interface BaselineDocument {
  contract: ContractHeader & { kind: 'baseline' };
  provenance: ContractProvenance;
  reportId: string;
  workflow: WorkflowIdentity;
  release: ReleaseIdentity;
}

export const BASELINE_BUNDLE_SCHEMA = 'savedyouatoken.cli/baseline-bundle';
export const BASELINE_BUNDLE_VERSION = { major: 1, minor: 0 } as const;

/**
 * A committable pairing of a `BaselineDocument` pointer with the full `ReportEnvelope` it points
 * to. `BaselineDocument` is only an identity pointer (a content hash) — core has no storage model
 * to resolve that hash back to a report, so any consumer that needs to (the CLI today; a future
 * SDK/Monitor integration) needs this exact pairing. The shape lives here so every consumer can
 * share one portable, browser-safe type; reading and writing it is runtime-specific (files for
 * the CLI, a database for a hosted service) and deliberately stays out of core.
 */
export interface BaselineBundle {
  schema: typeof BASELINE_BUNDLE_SCHEMA;
  version: ContractVersion;
  baseline: BaselineDocument;
  report: ReportEnvelope;
  /** Relative paths of the files the report was built from. Paths only — never prompt text. */
  sources?: string[];
  sourceRevision?: string;
}

export type EnforcementSeverity = 'warn' | 'fail';
export interface PolicyBudgets {
  maxInputTokens?: number;
  maxMonthlyCost?: number;
  maxTokenRegressionPercent?: number;
  maxCostRegressionPercent?: number;
}
export interface PolicyDocument {
  contract: ContractHeader & { kind: 'policy' };
  provenance: ContractProvenance;
  target: WorkflowIdentity;
  baselineId?: string;
  budgets: PolicyBudgets;
  pricing: { currency: 'USD'; modelId: string; catalogueDate: string };
  enforcement: EnforcementSeverity;
}

export type ContractDocument = ReportEnvelope | BaselineDocument | PolicyDocument;
export type ValidationErrorCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_value'
  | 'unsupported_major'
  | 'semantic_error';
export interface ContractValidationError { code: ValidationErrorCode; path: string; message: string }
export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ContractValidationError[] };

export class ContractValidationFailure extends Error {
  constructor(public readonly errors: ContractValidationError[]) {
    super(errors.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'ContractValidationFailure';
  }
}

export interface ReportEnvelopeInput {
  workflow: WorkflowIdentity;
  release: ReleaseIdentity;
  provenance: Omit<ContractProvenance, 'sourceContractVersion'>;
  maturity: MeasurementMaturity;
  window: ObservationWindow;
  engineVersion: string;
  rulesetId: string;
}

export function toReportEnvelope(result: AnalysisResult, input: ReportEnvelopeInput): ReportEnvelope {
  return {
    contract: { kind: 'report', version: { ...CONTRACT_VERSION } },
    workflow: input.workflow,
    release: input.release,
    provenance: input.provenance,
    maturity: input.maturity,
    window: input.window,
    catalogue: {
      engineVersion: input.engineVersion,
      rulesetId: input.rulesetId,
      modelCatalogueDate: PRICES_VERIFIED_ON,
      currency: 'USD',
      tokenizer: {
        family: result.tokenizer.family,
        accuracy: result.tokenizer.accuracy,
        counter: result.tokenizer.counterName,
      },
    },
    workload: { ...result.workload },
    analysis: {
      modelId: result.model.id,
      promptTokens: result.promptTokens,
      toolTokens: result.toolTokens,
      inputTokens: result.inputTokens,
      optimizedTokens: result.optimizedTokens,
      monthlyNow: round(result.costNow.perMonth),
      monthlyAfterRewrite: round(result.costAfterRewrite.perMonth),
      cacheSaving: round(result.cache.monthlySaving),
      findings: result.findings.map((finding) => ({
        ruleId: finding.ruleId,
        severity: finding.severity,
        occurrences: finding.occurrences,
        tokensSaved: round(finding.tokensSaved),
        monthlySaving: round(finding.monthlySaving),
      })),
    },
  };
}

export function parseReportEnvelope(input: unknown): ParseResult<ReportEnvelope> {
  return parseDocument(input, 'report') as ParseResult<ReportEnvelope>;
}
export function parseBaselineDocument(input: unknown): ParseResult<BaselineDocument> {
  return parseDocument(input, 'baseline') as ParseResult<BaselineDocument>;
}
export function parsePolicyDocument(input: unknown): ParseResult<PolicyDocument> {
  return parseDocument(input, 'policy') as ParseResult<PolicyDocument>;
}
export function parseContractDocument(input: unknown): ParseResult<ContractDocument> {
  const root = record(input);
  const kind = record(root?.contract)?.kind;
  if (kind === 'report' || kind === 'baseline' || kind === 'policy') return parseDocument(input, kind);
  return failure('invalid_value', '$.contract.kind', 'Expected report, baseline, or policy');
}

export function requireReportEnvelope(input: unknown): ReportEnvelope {
  const parsed = parseReportEnvelope(input);
  if (!parsed.ok) throw new ContractValidationFailure(parsed.errors);
  return parsed.value;
}

function parseDocument(input: unknown, expected: ContractKind): ParseResult<ContractDocument> {
  const errors: ContractValidationError[] = [];
  const root = needRecord(input, '$', errors);
  const contract = parseHeader(root.contract, expected, errors);
  if (!contract) return { ok: false, errors };

  let value: ContractDocument | null = null;
  if (expected === 'report') value = parseReport(root, contract, errors);
  if (expected === 'baseline') value = parseBaseline(root, contract, errors);
  if (expected === 'policy') value = parsePolicy(root, contract, errors);
  if (errors.length || !value) return { ok: false, errors };
  return { ok: true, value: migrateToCurrent(value) };
}

function parseHeader(value: unknown, expected: ContractKind, errors: ContractValidationError[]): ContractHeader | null {
  const obj = needRecord(value, '$.contract', errors);
  const kind = needString(obj.kind, '$.contract.kind', errors);
  const version = needRecord(obj.version, '$.contract.version', errors);
  const major = needInteger(version.major, '$.contract.version.major', errors, 0);
  const minor = needInteger(version.minor, '$.contract.version.minor', errors, 0);
  if (kind && kind !== expected) push(errors, 'invalid_value', '$.contract.kind', `Expected ${expected}`);
  if (major != null && major !== CONTRACT_MAJOR) {
    push(errors, 'unsupported_major', '$.contract.version.major', `Unsupported contract major ${major}`);
  }
  return errors.length || major == null || minor == null ? null : { kind: expected, version: { major, minor } };
}

function parseReport(root: Record<string, unknown>, contract: ContractHeader, errors: ContractValidationError[]): ReportEnvelope {
  const workflow = parseWorkflow(root.workflow, '$.workflow', errors);
  const release = parseRelease(root.release, '$.release', errors);
  const provenance = parseProvenance(root.provenance, errors);
  const maturityObj = needRecord(root.maturity, '$.maturity', errors);
  const maturityState = needEnum(maturityObj.state, '$.maturity.state', ['provisional', 'mature'], errors);
  const maturity = {
    state: (maturityState ?? 'provisional') as MeasurementMaturity['state'],
    observations: needInteger(maturityObj.observations, '$.maturity.observations', errors, 0) ?? 0,
  };
  const windowObj = needRecord(root.window, '$.window', errors);
  const window = {
    startedAt: needDate(windowObj.startedAt, '$.window.startedAt', errors),
    endedAt: needDate(windowObj.endedAt, '$.window.endedAt', errors),
    requests: needInteger(windowObj.requests, '$.window.requests', errors, 0) ?? 0,
  };
  if (window.startedAt && window.endedAt && window.startedAt > window.endedAt) {
    push(errors, 'semantic_error', '$.window', 'startedAt must not be after endedAt');
  }
  const cat = needRecord(root.catalogue, '$.catalogue', errors);
  const tokenizer = needRecord(cat.tokenizer, '$.catalogue.tokenizer', errors);
  const accuracy = needEnum(tokenizer.accuracy, '$.catalogue.tokenizer.accuracy', ['exact', 'estimated'], errors);
  const catalogue: CatalogueMetadata = {
    engineVersion: needString(cat.engineVersion, '$.catalogue.engineVersion', errors),
    rulesetId: needString(cat.rulesetId, '$.catalogue.rulesetId', errors),
    modelCatalogueDate: needDateOnly(cat.modelCatalogueDate, '$.catalogue.modelCatalogueDate', errors),
    currency: needLiteral(cat.currency, '$.catalogue.currency', 'USD', errors),
    tokenizer: {
      family: needString(tokenizer.family, '$.catalogue.tokenizer.family', errors),
      accuracy: (accuracy ?? 'estimated') as CatalogueMetadata['tokenizer']['accuracy'],
      counter: needString(tokenizer.counter, '$.catalogue.tokenizer.counter', errors),
    },
  };
  const workloadObj = needRecord(root.workload, '$.workload', errors);
  const cacheTtl = needEnum(workloadObj.cacheTtl, '$.workload.cacheTtl', ['5m', '1h'], errors);
  const workload: PortableWorkload = {
    requestsPerDay: needNumber(workloadObj.requestsPerDay, '$.workload.requestsPerDay', errors, 0) ?? 0,
    outputTokens: needNumber(workloadObj.outputTokens, '$.workload.outputTokens', errors, 0) ?? 0,
    cacheHitRate: needNumber(workloadObj.cacheHitRate, '$.workload.cacheHitRate', errors, 0, 1) ?? 0,
    cacheTtl: (cacheTtl ?? '5m') as PortableWorkload['cacheTtl'],
    batch: needBoolean(workloadObj.batch, '$.workload.batch', errors),
  };
  const analysisObj = needRecord(root.analysis, '$.analysis', errors);
  const findingsInput = needArray(analysisObj.findings, '$.analysis.findings', errors);
  const findings = findingsInput.map((item, index) => parseFinding(item, index, errors));
  const analysis: PortableAnalysis = {
    modelId: needString(analysisObj.modelId, '$.analysis.modelId', errors),
    promptTokens: needNumber(analysisObj.promptTokens, '$.analysis.promptTokens', errors, 0) ?? 0,
    toolTokens: needNumber(analysisObj.toolTokens, '$.analysis.toolTokens', errors, 0) ?? 0,
    inputTokens: needNumber(analysisObj.inputTokens, '$.analysis.inputTokens', errors, 0) ?? 0,
    optimizedTokens: needNumber(analysisObj.optimizedTokens, '$.analysis.optimizedTokens', errors, 0) ?? 0,
    monthlyNow: needNumber(analysisObj.monthlyNow, '$.analysis.monthlyNow', errors, 0) ?? 0,
    monthlyAfterRewrite: needNumber(analysisObj.monthlyAfterRewrite, '$.analysis.monthlyAfterRewrite', errors, 0) ?? 0,
    cacheSaving: needNumber(analysisObj.cacheSaving, '$.analysis.cacheSaving', errors, 0) ?? 0,
    findings,
  };
  return { contract: { ...contract, kind: 'report' }, workflow, release, provenance, maturity, window, catalogue, workload, analysis };
}

function parseBaseline(root: Record<string, unknown>, contract: ContractHeader, errors: ContractValidationError[]): BaselineDocument {
  const reportId = needIdentity(root.reportId, '$.reportId', errors);
  return {
    contract: { ...contract, kind: 'baseline' },
    provenance: parseProvenance(root.provenance, errors),
    reportId,
    workflow: parseWorkflow(root.workflow, '$.workflow', errors),
    release: parseRelease(root.release, '$.release', errors),
  };
}

function parsePolicy(root: Record<string, unknown>, contract: ContractHeader, errors: ContractValidationError[]): PolicyDocument {
  const budgetsObj = needRecord(root.budgets, '$.budgets', errors);
  const budgets: PolicyBudgets = {};
  optionalNumber(budgetsObj.maxInputTokens, '$.budgets.maxInputTokens', errors, budgets, 'maxInputTokens');
  optionalNumber(budgetsObj.maxMonthlyCost, '$.budgets.maxMonthlyCost', errors, budgets, 'maxMonthlyCost');
  optionalNumber(budgetsObj.maxTokenRegressionPercent, '$.budgets.maxTokenRegressionPercent', errors, budgets, 'maxTokenRegressionPercent');
  optionalNumber(budgetsObj.maxCostRegressionPercent, '$.budgets.maxCostRegressionPercent', errors, budgets, 'maxCostRegressionPercent');
  if (!Object.keys(budgets).length) push(errors, 'semantic_error', '$.budgets', 'At least one budget is required');
  const pricingObj = needRecord(root.pricing, '$.pricing', errors);
  const enforcement = needEnum(root.enforcement, '$.enforcement', ['warn', 'fail'], errors);
  const baselineId = root.baselineId == null ? undefined : needIdentity(root.baselineId, '$.baselineId', errors);
  return {
    contract: { ...contract, kind: 'policy' },
    provenance: parseProvenance(root.provenance, errors),
    target: parseWorkflow(root.target, '$.target', errors),
    ...(baselineId ? { baselineId } : {}),
    budgets,
    pricing: {
      currency: needLiteral(pricingObj.currency, '$.pricing.currency', 'USD', errors),
      modelId: needString(pricingObj.modelId, '$.pricing.modelId', errors),
      catalogueDate: needDateOnly(pricingObj.catalogueDate, '$.pricing.catalogueDate', errors),
    },
    enforcement: (enforcement ?? 'fail') as EnforcementSeverity,
  };
}

function migrateToCurrent<T extends ContractDocument>(document: T): T {
  if (document.contract.version.major !== CONTRACT_MAJOR || document.contract.version.minor !== 0) return document;
  return {
    ...document,
    contract: { ...document.contract, version: { ...CONTRACT_VERSION } },
    provenance: {
      ...document.provenance,
      sourceContractVersion: { major: CONTRACT_MAJOR, minor: 0 },
    },
  } as T;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalBytes(document: ContractDocument): Uint8Array {
  const parsed = parseContractDocument(document);
  if (!parsed.ok) throw new ContractValidationFailure(parsed.errors);
  return new TextEncoder().encode(canonicalStringify(parsed.value));
}

export async function contentIdentity(document: ContractDocument): Promise<string> {
  const bytes = canonicalBytes(document);
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  const obj = record(value);
  if (obj) {
    return Object.fromEntries(
      Object.keys(obj).sort().flatMap((key) => obj[key] === undefined ? [] : [[key.normalize('NFC'), canonicalValue(obj[key])]]),
    );
  }
  if (value === null || typeof value === 'boolean') return value;
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

export type ComparisonCompatibility =
  | { status: 'exact'; reasons: [] }
  | { status: 'approximate'; reasons: string[] }
  | { status: 'invalid'; reasons: string[] };

export function classifyReportCompatibility(a: ReportEnvelope, b: ReportEnvelope): ComparisonCompatibility {
  const invalid: string[] = [];
  if (a.contract.version.major !== b.contract.version.major) invalid.push('contract-major');
  if (a.workflow.id !== b.workflow.id) invalid.push('workflow');
  if (a.catalogue.currency !== b.catalogue.currency) invalid.push('currency');
  if (a.analysis.modelId !== b.analysis.modelId) invalid.push('model');
  if (invalid.length) return { status: 'invalid', reasons: invalid };
  const approximate: string[] = [];
  if (a.contract.version.minor !== b.contract.version.minor) approximate.push('contract-minor');
  if (a.catalogue.engineVersion !== b.catalogue.engineVersion) approximate.push('engine-version');
  if (a.catalogue.rulesetId !== b.catalogue.rulesetId) approximate.push('ruleset');
  if (a.catalogue.modelCatalogueDate !== b.catalogue.modelCatalogueDate) approximate.push('catalogue-date');
  if (a.maturity.state !== 'mature' || b.maturity.state !== 'mature') approximate.push('provisional-workload');
  return approximate.length ? { status: 'approximate', reasons: approximate } : { status: 'exact', reasons: [] };
}

export interface PolicyBreach { budget: keyof PolicyBudgets; actual: number; limit: number }
export interface PolicyEvaluation { outcome: 'pass' | 'warn' | 'fail'; breaches: PolicyBreach[] }
/**
 * `baselineId` is the content identity (from `contentIdentity()`) of the actual `baseline`
 * report being supplied, when the caller has one. It is optional and purely additive — omitting
 * it preserves prior behavior exactly — but when supplied alongside a `policy.baselineId`, a
 * mismatch is rejected. Without this, `baseline` only needs to be *compatible* (same workflow,
 * currency, model) with `report` to be accepted, which would let a caller silently evaluate
 * regression budgets against a baseline other than the one the policy was actually generated
 * against (e.g. a stale baseline from a prior release that happens to share those fields).
 */
export function evaluatePolicy(
  policy: PolicyDocument,
  report: ReportEnvelope,
  baseline?: ReportEnvelope,
  baselineId?: string,
): PolicyEvaluation {
  if (policy.target.id !== report.workflow.id) throw new Error('Policy target does not match report workflow');
  if (policy.pricing.currency !== report.catalogue.currency) throw new Error('Policy currency does not match report');
  if (policy.pricing.modelId !== report.analysis.modelId) throw new Error('Policy model does not match report');
  const needsBaseline = policy.budgets.maxTokenRegressionPercent != null || policy.budgets.maxCostRegressionPercent != null;
  if (needsBaseline && !baseline) throw new Error('Baseline report is required for regression budgets');
  if (baseline && policy.baselineId && baselineId && policy.baselineId !== baselineId) {
    throw new Error(`Supplied baseline (${baselineId}) does not match the baseline this policy was generated against (${policy.baselineId})`);
  }
  const breaches: PolicyBreach[] = [];
  addBreach(breaches, 'maxInputTokens', report.analysis.inputTokens, policy.budgets.maxInputTokens);
  addBreach(breaches, 'maxMonthlyCost', report.analysis.monthlyNow, policy.budgets.maxMonthlyCost);
  if (baseline) {
    const compatibility = classifyReportCompatibility(report, baseline);
    if (compatibility.status === 'invalid') throw new Error(`Incompatible baseline: ${compatibility.reasons.join(', ')}`);
    addBreach(breaches, 'maxTokenRegressionPercent', percentChange(baseline.analysis.inputTokens, report.analysis.inputTokens), policy.budgets.maxTokenRegressionPercent);
    addBreach(breaches, 'maxCostRegressionPercent', percentChange(baseline.analysis.monthlyNow, report.analysis.monthlyNow), policy.budgets.maxCostRegressionPercent);
  }
  return { outcome: breaches.length ? policy.enforcement : 'pass', breaches };
}

function addBreach(breaches: PolicyBreach[], budget: keyof PolicyBudgets, actual: number, limit?: number): void {
  if (limit != null && actual > limit) breaches.push({ budget, actual: round(actual), limit });
}
function percentChange(from: number, to: number): number { return from === 0 ? (to === 0 ? 0 : Infinity) : ((to - from) / from) * 100; }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
function record(value: unknown): Record<string, unknown> | null { return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function needRecord(value: unknown, path: string, errors: ContractValidationError[]): Record<string, unknown> { const obj = record(value); if (!obj) push(errors, value == null ? 'required' : 'invalid_type', path, 'Expected object'); return obj ?? {}; }
function needArray(value: unknown, path: string, errors: ContractValidationError[]): unknown[] { if (!Array.isArray(value)) { push(errors, value == null ? 'required' : 'invalid_type', path, 'Expected array'); return []; } return value; }
function needString(value: unknown, path: string, errors: ContractValidationError[]): string { if (typeof value !== 'string' || !value.trim()) { push(errors, value == null ? 'required' : 'invalid_type', path, 'Expected non-empty string'); return ''; } return value; }
function needBoolean(value: unknown, path: string, errors: ContractValidationError[]): boolean { if (typeof value !== 'boolean') { push(errors, value == null ? 'required' : 'invalid_type', path, 'Expected boolean'); return false; } return value; }
function needNumber(value: unknown, path: string, errors: ContractValidationError[], min?: number, max?: number): number | null { if (typeof value !== 'number' || !Number.isFinite(value)) { push(errors, value == null ? 'required' : 'invalid_type', path, 'Expected finite number'); return null; } if ((min != null && value < min) || (max != null && value > max)) push(errors, 'invalid_value', path, `Expected value between ${min ?? '-∞'} and ${max ?? '∞'}`); return value; }
function needInteger(value: unknown, path: string, errors: ContractValidationError[], min?: number): number | null { const n = needNumber(value, path, errors, min); if (n != null && !Number.isInteger(n)) push(errors, 'invalid_value', path, 'Expected integer'); return n; }
function needDate(value: unknown, path: string, errors: ContractValidationError[]): string { const s = needString(value, path, errors); if (s && Number.isNaN(Date.parse(s))) push(errors, 'invalid_value', path, 'Expected ISO date-time'); return s; }
function needDateOnly(value: unknown, path: string, errors: ContractValidationError[]): string { const s = needString(value, path, errors); if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) push(errors, 'invalid_value', path, 'Expected YYYY-MM-DD'); return s; }
function needEnum(value: unknown, path: string, values: readonly string[], errors: ContractValidationError[]): string | null { const s = needString(value, path, errors); if (s && !values.includes(s)) { push(errors, 'invalid_value', path, `Expected one of ${values.join(', ')}`); return null; } return s; }
function needLiteral<T extends string>(value: unknown, path: string, literal: T, errors: ContractValidationError[]): T { if (value !== literal) push(errors, value == null ? 'required' : 'invalid_value', path, `Expected ${literal}`); return literal; }
function needIdentity(value: unknown, path: string, errors: ContractValidationError[]): string { const s = needString(value, path, errors); if (s && !/^sha256:[a-f0-9]{64}$/.test(s)) push(errors, 'invalid_value', path, 'Expected sha256 content identity'); return s; }
function parseWorkflow(value: unknown, path: string, errors: ContractValidationError[]): WorkflowIdentity { const obj = needRecord(value, path, errors); const environment = obj.environment == null ? undefined : needString(obj.environment, `${path}.environment`, errors); return { id: needString(obj.id, `${path}.id`, errors), ...(environment ? { environment } : {}) }; }
function parseRelease(value: unknown, path: string, errors: ContractValidationError[]): ReleaseIdentity { const obj = needRecord(value, path, errors); const deployedAt = obj.deployedAt == null ? undefined : needDate(obj.deployedAt, `${path}.deployedAt`, errors); return { id: needString(obj.id, `${path}.id`, errors), ...(deployedAt ? { deployedAt } : {}) }; }
function parseProvenance(value: unknown, errors: ContractValidationError[]): ContractProvenance { const obj = needRecord(value, '$.provenance', errors); const sourceObj = obj.sourceContractVersion == null ? null : needRecord(obj.sourceContractVersion, '$.provenance.sourceContractVersion', errors); const source = sourceObj ? { major: needInteger(sourceObj.major, '$.provenance.sourceContractVersion.major', errors, 0) ?? 0, minor: needInteger(sourceObj.minor, '$.provenance.sourceContractVersion.minor', errors, 0) ?? 0 } : undefined; return { producer: needString(obj.producer, '$.provenance.producer', errors), producerVersion: needString(obj.producerVersion, '$.provenance.producerVersion', errors), generatedAt: needDate(obj.generatedAt, '$.provenance.generatedAt', errors), ...(source ? { sourceContractVersion: source } : {}) }; }
function parseFinding(value: unknown, index: number, errors: ContractValidationError[]): PortableFinding { const path = `$.analysis.findings[${index}]`; const obj = needRecord(value, path, errors); const severity = needEnum(obj.severity, `${path}.severity`, ['high', 'medium', 'low'], errors); return { ruleId: needString(obj.ruleId, `${path}.ruleId`, errors), severity: (severity ?? 'low') as Severity, occurrences: needInteger(obj.occurrences, `${path}.occurrences`, errors, 0) ?? 0, tokensSaved: needNumber(obj.tokensSaved, `${path}.tokensSaved`, errors, 0) ?? 0, monthlySaving: needNumber(obj.monthlySaving, `${path}.monthlySaving`, errors, 0) ?? 0 }; }
function optionalNumber<T extends object, K extends keyof T>(value: unknown, path: string, errors: ContractValidationError[], target: T, key: K): void { if (value == null) return; const n = needNumber(value, path, errors, 0); if (n != null) target[key] = n as T[K]; }
function push(errors: ContractValidationError[], code: ValidationErrorCode, path: string, message: string): void { errors.push({ code, path, message }); }
function failure<T>(code: ValidationErrorCode, path: string, message: string): ParseResult<T> { return { ok: false, errors: [{ code, path, message }] }; }
