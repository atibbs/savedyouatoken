import { formatTokens, formatUsd } from '@savedyouatoken/core';
import { appendFileSync } from 'node:fs';

import type {
  AuditEvent,
  AuditSink,
  HealthDestination,
  HealthEvent,
  OperationalContext,
  ReportEnvelope,
  SharedReport,
} from './types';

/** Does nothing. The production default when no destination is configured. */
export const noopSink: AuditSink = {
  emit() {
    /* intentionally silent */
  },
};

/**
 * A concise human-readable summary to the console. The development default.
 *
 * Runs in-process, so it may read the full result's per-prompt detail. Nothing it prints
 * leaves the machine.
 */
export function consoleSink(write: (line: string) => void = (l) => console.log(l)): AuditSink {
  return {
    emit(event) {
      if (event.kind === 'unknown-model') {
        write(
          `savedyouatoken: model "${event.rawModel}" is not in the pricing catalogue — audit skipped for this shape.`,
        );
        return;
      }
      const { result, matured, maturity } = event;
      const provisional = matured
        ? ''
        : ` (provisional ${Math.round(maturity.progress.overall * 100)}% — ${maturity.reasons.join(', ')})`;
      const lines: string[] = [];
      lines.push(
        `savedyouatoken · ${result.model.name} · ${formatTokens(result.inputTokens)} input tokens · ${formatUsd(result.costNow.perMonth)}/mo${provisional}`,
      );
      if (result.findings.length) {
        for (const f of result.findings.slice(0, 3)) {
          const money = f.monthlySaving > 0 ? ` — ${formatUsd(f.monthlySaving)}/mo` : '';
          lines.push(`  ${f.severity.padEnd(6)} ${f.title}${money}`);
        }
        if (result.topOpportunity) {
          lines.push(
            `  Biggest opportunity: ${result.topOpportunity.title} — ${formatUsd(result.topOpportunity.monthlySaving)}/mo`,
          );
        }
      } else {
        lines.push('  Nothing to flag.');
      }
      write(lines.join('\n'));
    },
  };
}

/**
 * Append each event to a file as JSON lines. Writes prompt-free legacy/portable reports and
 * bounded operational metadata, never the full result.
 */
export function fileSink(path: string): AuditSink {
  return {
    emit(event) {
      const payload =
        event.kind === 'analysis'
          ? {
              kind: 'analysis',
              shapeKey: event.shapeKey,
              matured: event.matured,
              maturity: event.maturity,
              report: event.report,
              portableReport: event.portableReport,
              operations: event.operations,
            }
          : { kind: 'unknown-model', shapeKey: event.shapeKey, rawModel: event.rawModel, operations: event.operations };
      appendFileSync(path, JSON.stringify(payload) + '\n', 'utf8');
    },
  };
}

/** Deliver each event to a caller-supplied function. In-process; full control. */
export function callbackSink(fn: (event: AuditEvent) => void): AuditSink {
  return {
    emit(event) {
      fn(event);
    },
  };
}

/** Deliver prompt-free instrumentation health to a caller-supplied function. */
export function callbackHealthDestination(fn: (event: HealthEvent) => unknown | Promise<unknown>): HealthDestination {
  return {
    async emit(event) {
      await fn(event);
    },
  };
}

export interface DashboardSinkOptions {
  url: string;
  /** Extra headers, e.g. an API key. */
  headers?: Record<string, string>;
  /** Injectable for testing; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Opt-in network destination. Transmits prompt-free legacy/portable reports and bounded
 * operational metadata—never per-prompt detail, tool names, or schema text. For an unknown
 * model it transmits only the raw model id plus operational context.
 *
 * The transmitted payload is prompt- and tool-text-free by construction; see the canary test.
 */
export function dashboardSink(opts: DashboardSinkOptions): AuditSink {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  return {
    async emit(event) {
      if (!doFetch) return;
      const body: {
        report?: SharedReport;
        portableReport?: ReportEnvelope;
        operations?: OperationalContext;
        unknownModel?: string;
      } = event.kind === 'analysis'
        ? { report: event.report, portableReport: event.portableReport, operations: event.operations }
        : { unknownModel: event.rawModel, operations: event.operations };
      const response = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Dashboard sink returned HTTP ${response.status}`);
    },
  };
}

export interface LocalWorkbenchSinkOptions {
  /** The ephemeral token `savedyouatoken workbench start` prints — required, since the
   *  workbench's /ingest route rejects anything else. */
  token: string;
  /** Defaults to the workbench's default local port. Override if it started on another one. */
  url?: string;
  /** Total attempts is `1 + maxRetries`. Defaults to 2 retries (3 attempts). */
  maxRetries?: number;
  /** Base delay before a retry, doubling each attempt. Defaults to 200ms. */
  retryDelayMs?: number;
  /** Injectable for testing; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_WORKBENCH_URL = 'http://127.0.0.1:4590/ingest';

/**
 * Opt-in local destination: posts the portable report directly to a running
 * `savedyouatoken workbench` instance on the same machine. Nothing else in the event — no
 * per-prompt `result`, no tool text — ever leaves the process; an `unknown-model` event has no
 * report to store and is skipped.
 *
 * The workbench is a local, on-demand process, so a request can legitimately arrive before it
 * has finished starting or during a restart — unlike `dashboardSink`, this retries a bounded
 * number of times with backoff before giving up. A final failure still throws, so the existing
 * sink-delivery health-event reporting in the auditor surfaces it the same way any other sink
 * failure would.
 */
export function localWorkbenchSink(opts: LocalWorkbenchSinkOptions): AuditSink {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const url = opts.url ?? DEFAULT_WORKBENCH_URL;
  const maxRetries = opts.maxRetries ?? 2;
  const retryDelayMs = opts.retryDelayMs ?? 200;

  return {
    async emit(event) {
      if (!doFetch || event.kind !== 'analysis') return;
      const body = JSON.stringify(event.portableReport);

      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await doFetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.token}` },
            body,
          });
          if (response.ok) return;
          lastError = new Error(`Workbench ingest returned HTTP ${response.status}`);
        } catch (err) {
          lastError = err;
        }
        if (attempt < maxRetries) await delay(retryDelayMs * 2 ** attempt);
      }
      throw lastError;
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
