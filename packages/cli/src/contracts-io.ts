/**
 * File I/O for the versioned report/baseline/policy contracts from `@savedyouatoken/core`.
 *
 * Core defines the document shapes, parsers, and the content-identity hash; it does not know
 * about files on disk. A `BaselineDocument` is only a `reportId` pointer (a content hash) plus
 * workflow/release identity — core never resolves that hash back to a full report, because it
 * has no storage model. The CLI's answer is the *baseline bundle*: one committed JSON file that
 * carries the `BaselineDocument` pointer next to the full `ReportEnvelope` it points to, so a
 * later `compare` or `policy check` can load both from a single path. The bundle format is a
 * CLI-owned envelope, not a core contract kind — its own `schema`/`version` fields let it evolve
 * independently of `contract.version` on the documents it carries.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  BASELINE_BUNDLE_SCHEMA,
  BASELINE_BUNDLE_VERSION,
  type BaselineBundle,
  type BaselineDocument,
  type ContractValidationError,
  type PolicyDocument,
  type ReportEnvelope,
  canonicalStringify,
  contentIdentity,
  parseBaselineDocument,
  parsePolicyDocument,
  parseReportEnvelope,
} from '@savedyouatoken/core';
import { fail } from './support';

export { BASELINE_BUNDLE_SCHEMA, BASELINE_BUNDLE_VERSION, type BaselineBundle };

export function formatContractErrors(errors: ContractValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message} [${e.code}]`).join('\n');
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return fail(`Cannot read ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    return fail(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function writeCanonical(path: string, document: unknown): void {
  writeFileSync(path, canonicalStringify(document) + '\n', 'utf8');
}

export async function writeBaselineBundle(path: string, bundle: BaselineBundle): Promise<void> {
  writeFileSync(path, JSON.stringify(bundle, sortedReplacer, 2) + '\n', 'utf8');
}

// Baseline bundles are reviewed and diffed by humans in pull requests, so they are written with
// stable key order and 2-space indentation rather than the compact canonical form used for the
// wire contracts nested inside them (those still hash exactly the same either way).
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
  }
  return value;
}

export async function readBaselineBundle(path: string): Promise<BaselineBundle> {
  const raw = readJson(path) as Record<string, unknown>;
  if (raw?.schema !== BASELINE_BUNDLE_SCHEMA) {
    fail(`${path} is not a savedyouatoken baseline bundle (missing or unrecognised "schema").`);
  }
  const reportParsed = parseReportEnvelope(raw.report);
  if (!reportParsed.ok) {
    fail(`${path}: embedded report failed validation:\n${formatContractErrors(reportParsed.errors)}`);
  }
  const baselineParsed = parseBaselineDocument(raw.baseline);
  if (!baselineParsed.ok) {
    fail(`${path}: embedded baseline failed validation:\n${formatContractErrors(baselineParsed.errors)}`);
  }
  const report = (reportParsed as { ok: true; value: ReportEnvelope }).value;
  const baseline = (baselineParsed as { ok: true; value: BaselineDocument }).value;

  const actualId = await contentIdentity(report);
  if (actualId !== baseline.reportId) {
    fail(
      `${path} is corrupt or was hand-edited: the embedded report's content identity ` +
        `(${actualId}) does not match baseline.reportId (${baseline.reportId}). Re-run ` +
        `\`savedyouatoken baseline create\` to regenerate it.`,
    );
  }

  return {
    schema: BASELINE_BUNDLE_SCHEMA,
    version: (raw.version as { major: number; minor: number } | undefined) ?? { ...BASELINE_BUNDLE_VERSION },
    baseline,
    report,
    sources: Array.isArray(raw.sources) ? (raw.sources as string[]) : undefined,
    sourceRevision: typeof raw.sourceRevision === 'string' ? raw.sourceRevision : undefined,
  };
}

export function readReportEnvelope(path: string): ReportEnvelope {
  const parsed = parseReportEnvelope(readJson(path));
  if (!parsed.ok) fail(`${path} is not a valid report:\n${formatContractErrors(parsed.errors)}`);
  return (parsed as { ok: true; value: ReportEnvelope }).value;
}

export function readPolicyDocument(path: string): PolicyDocument {
  const parsed = parsePolicyDocument(readJson(path));
  if (!parsed.ok) fail(`${path} is not a valid policy:\n${formatContractErrors(parsed.errors)}`);
  return (parsed as { ok: true; value: PolicyDocument }).value;
}

export function writePolicyDocument(path: string, policy: PolicyDocument): void {
  writeCanonical(path, policy);
}
