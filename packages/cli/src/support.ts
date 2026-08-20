/**
 * Small pieces shared across every CLI command: process-exit conventions, terminal colour,
 * version resolution, and the single-file analysis pipeline that `audit`, `baseline`,
 * `compare`, and `policy` all build reports from.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import {
  ANALYSIS_ENGINE_VERSION,
  DEFAULT_MODEL_ID,
  DEFAULT_WORKLOAD,
  RULESET_ID,
  analyze,
  createCounterFromO200k,
  getModel,
  toReportEnvelope,
  type AnalysisResult,
  type ReleaseIdentity,
  type ReportEnvelope,
  type WorkflowIdentity,
} from '@savedyouatoken/core';

// Replaced at build time by tsup `define` with the package.json version. The fallback covers
// running the TypeScript source directly (npm run cli), where the define is not applied.
declare const __CLI_VERSION__: string;
export const VERSION = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0-dev';

/** Every exit uses code 2 for usage/configuration problems, distinct from a failed budget (1). */
export function fail(message: string): never {
  process.stderr.write(`savedyouatoken: ${message}\n`);
  process.exit(2);
}

export const supportsColour = process.stdout.isTTY && process.env.NO_COLOR == null;
export const c = {
  dim: (s: string) => (supportsColour ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (supportsColour ? `\x1b[1m${s}\x1b[0m` : s),
  green: (s: string) => (supportsColour ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColour ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (supportsColour ? `\x1b[31m${s}\x1b[0m` : s),
};

export interface AuditOptions {
  model: string;
  requestsPerDay: number;
  outputTokens: number;
  cacheHitRate: number;
  toolsFile?: string;
  aggressive: boolean;
}

export function defaultAuditOptions(): AuditOptions {
  return {
    model: DEFAULT_MODEL_ID,
    requestsPerDay: DEFAULT_WORKLOAD.requestsPerDay,
    outputTokens: DEFAULT_WORKLOAD.outputTokens,
    cacheHitRate: 0,
    aggressive: false,
  };
}

/**
 * Consumes the audit flags (-m/-r/-o/-c/-t/--aggressive) that discovery, baseline, compare,
 * and policy commands all accept identically to the default `audit` command. Any argument the
 * loop does not recognise is left in place for the caller's own command-specific parsing, so
 * callers can interleave shared and command-specific flags in one `parseArgs` pass.
 */
export function consumeAuditFlag(arg: string, next: () => string, options: AuditOptions): boolean {
  switch (arg) {
    case '-m':
    case '--model':
      options.model = next();
      return true;
    case '-r':
    case '--requests':
      options.requestsPerDay = Number(next());
      return true;
    case '-o':
    case '--output-tokens':
      options.outputTokens = Number(next());
      return true;
    case '-c':
    case '--cache-hit-rate':
      options.cacheHitRate = Number(next()) / 100;
      return true;
    case '-t':
    case '--tools':
      options.toolsFile = next();
      return true;
    case '--aggressive':
      options.aggressive = true;
      return true;
    default:
      return false;
  }
}

export function requireKnownModel(options: AuditOptions): void {
  if (!getModel(options.model)) {
    fail(`Unknown model "${options.model}". Run \`savedyouatoken models\` for the list.`);
  }
}

/** Runs the same deterministic pipeline the default audit command uses, for exactly one file. */
export function analyzeFile(file: string, options: AuditOptions): AnalysisResult {
  const counter = createCounterFromO200k((text) => encode(text), 'o200k_base');
  let toolsSource = '';
  if (options.toolsFile) {
    try {
      toolsSource = readFileSync(options.toolsFile, 'utf8');
    } catch {
      return fail(`Cannot read ${options.toolsFile}`);
    }
  }
  let prompt: string;
  try {
    prompt = readFileSync(file, 'utf8');
  } catch {
    return fail(`Cannot read ${file}`);
  }
  return analyze({
    prompt,
    toolsSource,
    modelId: options.model,
    aggressive: options.aggressive,
    counter,
    workload: {
      requestsPerDay: options.requestsPerDay,
      outputTokens: options.outputTokens,
      cacheHitRate: options.cacheHitRate,
      cacheTtl: '5m',
      batch: false,
    },
  });
}

/** Best-effort source revision for provenance. Never throws — git may not be installed or the
 *  directory may not be a repository, and neither should block a baseline or policy from being
 *  written. */
export function gitRevision(cwd = process.cwd()): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds a single-observation, provisional ReportEnvelope from a live analysis — the shape
 * `baseline create`, `compare`, and `policy generate`/`check` all need when working from a file
 * on disk rather than an already-captured (`--from-report`) report. Centralizing this also
 * centralizes release-id resolution: when the caller doesn't supply one, it falls back to the
 * current git revision rather than each call site independently deciding whether to bother.
 */
export function buildProvisionalReport(
  result: AnalysisResult,
  identity: { workflow: WorkflowIdentity; release?: ReleaseIdentity },
): ReportEnvelope {
  const generatedAt = new Date().toISOString();
  return toReportEnvelope(result, {
    workflow: identity.workflow,
    release: identity.release ?? { id: gitRevision() ?? 'unversioned' },
    provenance: { producer: 'savedyouatoken', producerVersion: VERSION, generatedAt },
    maturity: { state: 'provisional', observations: 1 },
    window: { startedAt: generatedAt, endedAt: generatedAt, requests: 1 },
    engineVersion: ANALYSIS_ENGINE_VERSION,
    rulesetId: RULESET_ID,
  });
}
