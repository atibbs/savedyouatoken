import { formatTokens, formatUsd } from '@savedyouatoken/core';
import { appendFileSync } from 'node:fs';

import type { AuditEvent, AuditSink, SharedReport } from './types';

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
      const { result, matured } = event;
      const provisional = matured ? '' : ' (provisional workload — still measuring traffic)';
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
 * Append each event to a file as JSON lines. Writes the prompt-free `report`, never the full
 * result, so a file that gets committed or shared cannot leak prompt or tool text.
 */
export function fileSink(path: string): AuditSink {
  return {
    emit(event) {
      const payload =
        event.kind === 'analysis'
          ? { kind: 'analysis', shapeKey: event.shapeKey, matured: event.matured, report: event.report }
          : { kind: 'unknown-model', shapeKey: event.shapeKey, rawModel: event.rawModel };
      try {
        appendFileSync(path, JSON.stringify(payload) + '\n', 'utf8');
      } catch {
        /* a sink must never throw into the auditor */
      }
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

export interface DashboardSinkOptions {
  url: string;
  /** Extra headers, e.g. an API key. */
  headers?: Record<string, string>;
  /** Injectable for testing; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Opt-in network destination. Transmits ONLY the prompt-free `report` (core's `toSharedReport`,
 * which carries counts, figures, and static rule identifiers — never per-prompt detail, tool
 * names, or schema text). For an unknown model it transmits only the raw model id.
 *
 * The transmitted payload is prompt- and tool-text-free by construction; see the canary test.
 */
export function dashboardSink(opts: DashboardSinkOptions): AuditSink {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  return {
    async emit(event) {
      if (!doFetch) return;
      const body: { report?: SharedReport; unknownModel?: string } =
        event.kind === 'analysis' ? { report: event.report } : { unknownModel: event.rawModel };
      try {
        await doFetch(opts.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
          body: JSON.stringify(body),
        });
      } catch {
        /* network failure must never reach the caller */
      }
    },
  };
}
