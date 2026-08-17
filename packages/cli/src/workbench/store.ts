/**
 * The workbench's local data boundary: immutable source `ReportEnvelope` documents on disk, plus
 * a disposable index rebuildable from them. There is no prior local-storage convention anywhere
 * in this repo, so this module defines one — see `resolveDataDir` — rather than reusing an
 * existing pattern.
 *
 * Every document that reaches disk has already passed through `@savedyouatoken/core`'s contract
 * parser, which is what makes it prompt-free: `ReportEnvelope` structurally cannot carry prompt
 * text, tool schemas, or per-finding detail (see docs/contracts.md). This module never inspects
 * or trusts anything beyond that parsed shape.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type ContractValidationError,
  type EnforcementSeverity,
  type PolicyBudgets,
  type ReportEnvelope,
  canonicalStringify,
  contentIdentity,
  parseReportEnvelope,
} from '@savedyouatoken/core';

/** A raw report document larger than this is rejected before parsing — reports are compact,
 *  prompt-free metadata, so anything past a generous margin indicates a misbehaving sender
 *  rather than a legitimate report. */
export const MAX_REPORT_BYTES = 256 * 1024;

export interface IndexEntry {
  id: string;
  workflowId: string;
  environment?: string;
  releaseId: string;
  modelId: string;
  contractMajor: number;
  contractMinor: number;
  maturityState: 'provisional' | 'mature';
  observations: number;
  generatedAt: string;
  receivedAt: string;
  inputTokens: number;
  monthlyNow: number;
}

export interface BaselineApproval {
  id: string;
  reportId: string;
  workflowId: string;
  approvedAt: string;
  acknowledgedProvisional: boolean;
  tolerance: PolicyBudgets;
  enforcement: EnforcementSeverity;
}

export type IngestResult =
  | { ok: true; id: string; isNew: boolean }
  | { ok: false; errors: ContractValidationError[] };

/**
 * Resolves the local data directory. No environment variable or dotfile convention existed in
 * this repo before the workbench, so `SAVEDYOUATOKEN_WORKBENCH_DIR` and `~/.savedyouatoken/workbench`
 * are new — documented in docs/local-monitoring-workbench.md.
 */
export function resolveDataDir(override?: string): string {
  return override ?? process.env.SAVEDYOUATOKEN_WORKBENCH_DIR ?? join(homedir(), '.savedyouatoken', 'workbench');
}

function reportsDir(dataDir: string): string {
  return join(dataDir, 'reports');
}
function indexPath(dataDir: string): string {
  return join(dataDir, 'index.json');
}
function baselinesPath(dataDir: string): string {
  return join(dataDir, 'baselines.json');
}

function ensureDataDir(dataDir: string): void {
  mkdirSync(reportsDir(dataDir), { recursive: true });
}

/** Filenames can't safely contain ":" (Windows) — the "sha256:" prefix is reapplied on read. */
function reportFilename(id: string): string {
  return `${id.replace(/^sha256:/, '')}.json`;
}

/** Validates and persists one report. Reports are immutable and content-addressed: ingesting an
 *  identical document twice is a no-op (isNew: false), never a duplicate or an overwrite. */
export async function ingestReport(dataDir: string, raw: string): Promise<IngestResult> {
  if (Buffer.byteLength(raw, 'utf8') > MAX_REPORT_BYTES) {
    return { ok: false, errors: [{ code: 'invalid_value', path: '$', message: `Report exceeds ${MAX_REPORT_BYTES} bytes` }] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [{ code: 'invalid_type', path: '$', message: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}` }] };
  }
  const result = parseReportEnvelope(parsed);
  if (!result.ok) return { ok: false, errors: result.errors };

  const report = result.value;
  ensureDataDir(dataDir);
  const id = await contentIdentity(report);
  const path = join(reportsDir(dataDir), reportFilename(id));
  const isNew = !existsSync(path);
  if (isNew) {
    writeFileSync(path, canonicalStringify(report), 'utf8');
    appendToIndex(dataDir, id, report);
  }
  return { ok: true, id, isNew };
}

function appendToIndex(dataDir: string, id: string, report: ReportEnvelope): void {
  const index = readIndexRaw(dataDir) ?? [];
  if (index.some((e) => e.id === id)) return;
  index.push(toIndexEntry(id, report));
  writeFileSync(indexPath(dataDir), JSON.stringify(index, null, 2), 'utf8');
}

function toIndexEntry(id: string, report: ReportEnvelope): IndexEntry {
  return {
    id,
    workflowId: report.workflow.id,
    environment: report.workflow.environment,
    releaseId: report.release.id,
    modelId: report.analysis.modelId,
    contractMajor: report.contract.version.major,
    contractMinor: report.contract.version.minor,
    maturityState: report.maturity.state,
    observations: report.maturity.observations,
    generatedAt: report.provenance.generatedAt,
    receivedAt: new Date().toISOString(),
    inputTokens: report.analysis.inputTokens,
    monthlyNow: report.analysis.monthlyNow,
  };
}

function readIndexRaw(dataDir: string): IndexEntry[] | null {
  try {
    return JSON.parse(readFileSync(indexPath(dataDir), 'utf8'));
  } catch {
    return null;
  }
}

/** The index is disposable: if it's missing or corrupt, rebuild it by re-reading every stored
 *  report from scratch. Source documents are the only durable state. */
export function rebuildIndex(dataDir: string): IndexEntry[] {
  ensureDataDir(dataDir);
  const dir = reportsDir(dataDir);
  const entries: IndexEntry[] = [];
  for (const filename of existsSync(dir) ? readdirSync(dir) : []) {
    if (!filename.endsWith('.json')) continue;
    try {
      const report = JSON.parse(readFileSync(join(dir, filename), 'utf8')) as ReportEnvelope;
      const id = `sha256:${filename.replace(/\.json$/, '')}`;
      entries.push(toIndexEntry(id, report));
    } catch {
      // A corrupt individual report file must not block rebuilding the rest of the index.
      continue;
    }
  }
  writeFileSync(indexPath(dataDir), JSON.stringify(entries, null, 2), 'utf8');
  return entries;
}

export function listReports(dataDir: string): IndexEntry[] {
  return readIndexRaw(dataDir) ?? rebuildIndex(dataDir);
}

export function getReport(dataDir: string, id: string): ReportEnvelope | undefined {
  try {
    return JSON.parse(readFileSync(join(reportsDir(dataDir), reportFilename(id)), 'utf8'));
  } catch {
    return undefined;
  }
}

export function recordBaselineApproval(dataDir: string, approval: Omit<BaselineApproval, 'id'>): BaselineApproval {
  ensureDataDir(dataDir);
  const full: BaselineApproval = { id: randomUUID(), ...approval };
  const list = readBaselinesRaw(dataDir);
  list.push(full);
  writeFileSync(baselinesPath(dataDir), JSON.stringify(list, null, 2), 'utf8');
  return full;
}

function readBaselinesRaw(dataDir: string): BaselineApproval[] {
  try {
    return JSON.parse(readFileSync(baselinesPath(dataDir), 'utf8'));
  } catch {
    return [];
  }
}

export function listBaselineApprovals(dataDir: string): BaselineApproval[] {
  return readBaselinesRaw(dataDir);
}

/** The most recently approved baseline for a workflow — later approvals supersede earlier ones,
 *  never overwriting the approval history itself. */
export function latestBaselineApproval(dataDir: string, workflowId: string): BaselineApproval | undefined {
  const matches = readBaselinesRaw(dataDir).filter((a) => a.workflowId === workflowId);
  return matches.length ? matches[matches.length - 1] : undefined;
}

export function exportStore(dataDir: string, outDir: string): { reportsCopied: number } {
  ensureDataDir(dataDir);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'reports'), { recursive: true });
  const dir = reportsDir(dataDir);
  let count = 0;
  for (const filename of existsSync(dir) ? readdirSync(dir) : []) {
    if (!filename.endsWith('.json')) continue;
    writeFileSync(join(outDir, 'reports', filename), readFileSync(join(dir, filename)));
    count++;
  }
  if (existsSync(indexPath(dataDir))) writeFileSync(join(outDir, 'index.json'), readFileSync(indexPath(dataDir)));
  if (existsSync(baselinesPath(dataDir))) writeFileSync(join(outDir, 'baselines.json'), readFileSync(baselinesPath(dataDir)));
  return { reportsCopied: count };
}

/** Deletes every stored report, the index, and baseline approvals. Never touches anything
 *  outside `dataDir` — in particular, never touches source policy files a user has committed to
 *  their repository, since those are not part of this store. */
export function deleteStore(dataDir: string): void {
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
}
