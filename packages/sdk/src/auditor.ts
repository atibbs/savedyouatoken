import {
  ANALYSIS_ENGINE_VERSION,
  RULESET_ID,
  analyze,
  toReportEnvelope,
  toSharedReport,
  type TokenCounter,
  type Workload,
} from '@savedyouatoken/core';

import type { AuditEvent, AuditorOptions, AuditSink, RequestAdapter, WorkloadOverrides } from './types';
import { createDefaultCounter } from './counter';
import { normaliseModelId } from './normalise-model';
import { hashString, ShapeState, skeleton } from './shape';
import {
  TrafficWindow,
  workloadChangedMaterially,
  type TrafficConfig,
} from './traffic';
import { consoleSink, noopSink } from './sinks';

interface ShapeRecord {
  state: ShapeState;
  traffic: TrafficWindow;
  modelId: string | null;
  rawModel: string;
  toolsSource: string;
  /** Signature of the last analysed input, to detect a changed shape. */
  lastAnalysisSignature: string | null;
  /** Workload behind the last emitted report, to detect a material change. */
  lastEmittedWorkload: Workload | null;
  /** When we last emitted, to rate-limit re-audits of an unchanged, stable shape. */
  lastEmitAt: number;
}

export interface Auditor {
  /** Observe one request (and its response, if available). Never throws. */
  observe(params: unknown, response?: unknown): void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
declare const __SDK_VERSION__: string;
const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.0.0-dev';

/**
 * Build an auditor for one provider adapter. `observe()` captures, normalises, deduplicates by
 * shape, measures the workload from traffic, and emits an analysis to the configured sink(s) —
 * reusing `@savedyouatoken/core.analyze` verbatim, never reimplementing analysis.
 */
export function createAuditor(adapter: RequestAdapter, options: AuditorOptions = {}): Auditor {
  const counter: TokenCounter = options.counter ?? createDefaultCounter();
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env.NODE_ENV ?? 'development';
  const maxShapes = options.maxShapes ?? 500;
  const reauditIntervalMs = options.reauditIntervalMs ?? 6 * 60 * 60 * 1000;
  const mask = options.mask;

  const trafficConfig: TrafficConfig = {
    windowMs: options.trafficWindowMs ?? DAY_MS,
    minObservationsForMaturity: options.minObservationsForMaturity ?? 20,
    minSpanMsForMaturity: options.minSpanMsForMaturity ?? 5 * 60 * 1000,
    overrides: options.workload ?? {},
  };

  const sinks: AuditSink[] = resolveSinks(options, env);

  // Bounded LRU of shapes. Map preserves insertion order; re-insertion marks recency.
  const shapes = new Map<string, ShapeRecord>();

  function emit(event: AuditEvent): void {
    for (const sink of sinks) {
      try {
        Promise.resolve(sink.emit(event)).catch(() => {});
      } catch {
        // A sink must never break the auditor.
      }
    }
  }

  // The whole capture path — `adapter.extract`, a caller-provided `mask`, and
  // `JSON.stringify(tools)` (which throws on a circular tool object) — runs inside this guard,
  // so the documented manual `auditor.observe(...)` upholds its never-throws contract even for a
  // custom adapter/mask that misbehaves, not only when called through the wrappers.
  function observe(params: unknown, response?: unknown): void {
    try {
      runObserve(params, response);
    } catch {
      // Capture or analysis failure must never reach the caller.
    }
  }

  function runObserve(params: unknown, response?: unknown): void {
    const captured = adapter.extract(params, response);
    if (!captured) return;

    // The auditor's own clock drives traffic windowing — the moment we observe the request —
    // so it is injectable for testing and independent of whatever the adapter stamped.
    const t = now();
    const resolution = normaliseModelId(captured.model);
    const maskedSystem = mask ? mask(captured.system) : captured.system;
    const toolsSource = captured.tools && captured.tools.length ? JSON.stringify(captured.tools) : '';

    // Shape identity is over the *stable* portion: model + skeletonised system + tools. The
    // skeleton neutralises structurally-variable tokens (timestamps, UUIDs, ids), and the
    // caller mask handles domain-specific variables — these are deliberately *deterministic*:
    // the identity never fuzzily merges two dissimilar prompts, which for an audit tool would
    // silently blend two services' costs. Within a shape, line-level stability inference
    // (ShapeState) then drops any residual per-request line from the analysed text.
    const shapeKey = hashString(
      `${resolution.modelId ?? resolution.raw}\n${skeleton(maskedSystem)}\n${toolsSource}`,
    );

    let record = shapes.get(shapeKey);
    if (record) {
      // Touch for LRU recency.
      shapes.delete(shapeKey);
      shapes.set(shapeKey, record);
    } else {
      record = {
        state: new ShapeState(),
        traffic: new TrafficWindow(trafficConfig),
        modelId: resolution.modelId,
        rawModel: resolution.raw,
        toolsSource,
        lastAnalysisSignature: null,
        lastEmittedWorkload: null,
        lastEmitAt: 0,
      };
      shapes.set(shapeKey, record);
      evictIfNeeded();
    }

    // Collect traffic on every observation, independent of whether we analyse.
    record.state.observe(maskedSystem);
    record.traffic.add(
      t,
      captured.observedOutputTokens,
      (captured.observedCacheReadTokens ?? 0) > 0,
    );

    // An unmappable model can't be priced. Surface it once, then stop repeating for this shape.
    if (record.modelId == null) {
      if (record.lastAnalysisSignature !== 'unknown-model') {
        record.lastAnalysisSignature = 'unknown-model';
        emit({ kind: 'unknown-model', shapeKey, rawModel: record.rawModel });
      }
      return;
    }

    const stableSystem = record.state.stableSystem();
    const measured = record.traffic.measure(t);
    const analysisSignature = hashString(`${record.modelId}\n${stableSystem}\n${record.toolsSource}`);

    const shapeChanged = record.lastAnalysisSignature !== analysisSignature;
    const workloadChanged =
      record.lastEmittedWorkload != null &&
      workloadChangedMaterially(record.lastEmittedWorkload, measured.workload);
    const intervalElapsed = t - record.lastEmitAt >= reauditIntervalMs;
    const firstSight = record.lastAnalysisSignature == null;

    if (!(firstSight || shapeChanged || workloadChanged || intervalElapsed)) return;

    let result;
    try {
      result = analyze({
        prompt: stableSystem,
        toolsSource: record.toolsSource,
        modelId: record.modelId,
        workload: measured.workload,
        counter,
      });
    } catch {
      // Reuse core's error boundary philosophy: a failed analysis never reaches the caller.
      return;
    }

    record.lastAnalysisSignature = analysisSignature;
    record.lastEmittedWorkload = measured.workload;
    record.lastEmitAt = t;

    emit({
      kind: 'analysis',
      shapeKey,
      result,
      report: toSharedReport(result),
      portableReport: toReportEnvelope(result, {
        workflow: {
          id: options.reportContext?.workflowId ?? shapeKey,
          ...(options.reportContext?.environment ? { environment: options.reportContext.environment } : {}),
        },
        release: {
          id: options.reportContext?.releaseId ?? 'unversioned',
          ...(options.reportContext?.deployedAt ? { deployedAt: options.reportContext.deployedAt } : {}),
        },
        provenance: {
          producer: '@savedyouatoken/sdk',
          producerVersion: SDK_VERSION,
          generatedAt: new Date(t).toISOString(),
        },
        maturity: { state: measured.matured ? 'mature' : 'provisional', observations: measured.observations },
        window: {
          startedAt: new Date(measured.startedAt).toISOString(),
          endedAt: new Date(measured.endedAt).toISOString(),
          requests: measured.observations,
        },
        engineVersion: ANALYSIS_ENGINE_VERSION,
        rulesetId: RULESET_ID,
      }),
      matured: measured.matured,
    });
  }

  function evictIfNeeded(): void {
    while (shapes.size > maxShapes) {
      const oldest = shapes.keys().next().value;
      if (oldest === undefined) break;
      shapes.delete(oldest);
    }
  }

  return { observe };
}

function resolveSinks(options: AuditorOptions, env: string): AuditSink[] {
  if (options.sinks && options.sinks.length) return options.sinks;
  if (options.sink) return [options.sink];
  return [env === 'production' ? noopSink : consoleSink()];
}

export type { WorkloadOverrides };
