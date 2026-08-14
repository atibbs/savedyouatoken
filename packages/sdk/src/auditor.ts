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
import { ShapeDiagnosticsTracker } from './diagnostics';
import { HealthDispatcher } from './health';
import { normaliseModelId } from './normalise-model';
import { resolveOperationalConfiguration } from './operations';
import { hashString, ShapeState, skeleton } from './shape';
import {
  TrafficWindow,
  workloadChangedMaterially,
  type TrafficConfig,
} from './traffic';
import { consoleSink, noopSink } from './sinks';

interface ShapeRecord {
  state: ShapeState;
  modelId: string | null;
  rawModel: string;
  toolsSource: string;
  /** Signature of the last analysed input, to detect a changed shape. */
  lastAnalysisSignature: string | null;
  /** Workload behind the last emitted report, to detect a material change. */
  lastEmittedWorkload: Workload | null;
  /** When we last emitted, to rate-limit re-audits of an unchanged, stable shape. */
  lastEmitAt: number;
  /** State/progress bucket behind the last report, so maturity transitions always emit. */
  lastMaturitySignature: string | null;
}

export interface Auditor {
  /** Observe one request (and its response, if available). Never throws. */
  observe(params: unknown, response?: unknown): void;
  /** Used by wrappers to report an unavailable provider method without throwing. */
  notifyUnsupportedMethod(method: string): void;
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
  const operational = resolveOperationalConfiguration(options, adapter.provider, SDK_VERSION);
  const health = new HealthDispatcher(
    operational.health,
    adapter.provider,
    operational.context.workflow.id,
    now,
    operational.healthRateLimitMs,
  );

  const trafficConfig: TrafficConfig = {
    windowMs: options.trafficWindowMs ?? DAY_MS,
    maturity: operational.maturity,
    overrides: options.workload ?? {},
  };
  const traffic = new TrafficWindow(trafficConfig);
  const diagnostics = new ShapeDiagnosticsTracker(operational.diagnostics, Boolean(mask));

  const sinks: AuditSink[] = resolveSinks(options, env);

  // Bounded LRU of shapes. Map preserves insertion order; re-insertion marks recency.
  const shapes = new Map<string, ShapeRecord>();

  health.emit({
    kind: 'initialization',
    status: operational.context.configurationMode === 'configured' ? 'ready' : 'compatibility',
    ...(operational.metadataRejected.length ? { metadataRejected: operational.metadataRejected } : {}),
  }, true);

  function emit(event: AuditEvent): void {
    for (const [sinkIndex, sink] of sinks.entries()) {
      try {
        Promise.resolve(sink.emit(event)).then(
          () => health.emit({ kind: 'sink-delivery', destination: 'audit', sinkIndex, status: 'delivered' }),
          () => health.emit({ kind: 'sink-delivery', destination: 'audit', sinkIndex, status: 'failed' }),
        );
      } catch {
        health.emit({ kind: 'sink-delivery', destination: 'audit', sinkIndex, status: 'failed' });
      }
    }
  }

  // The whole capture path — `adapter.extract`, a caller-provided `mask`, and
  // `JSON.stringify(tools)` (which throws on a circular tool object) — runs inside this guard,
  // so the documented manual `auditor.observe(...)` upholds its never-throws contract even for a
  // custom adapter/mask that misbehaves, not only when called through the wrappers.
  function observe(params: unknown, response?: unknown): void {
    let captured;
    try {
      captured = adapter.extract(params, response);
    } catch {
      health.emit({ kind: 'capture', status: 'failed', code: 'adapter-error' });
      return;
    }
    if (!captured) {
      health.emit({ kind: 'capture', status: 'skipped', code: 'adapter-no-match' });
      return;
    }
    health.emit({ kind: 'capture', status: 'captured' });
    try {
      runCaptured(captured);
    } catch {
      health.emit({ kind: 'capture', status: 'failed', code: 'processing-error' });
    }
  }

  function runCaptured(captured: NonNullable<ReturnType<RequestAdapter['extract']>>): void {
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
    const rawShapeKey = hashString(
      `${resolution.modelId ?? resolution.raw}\n${skeleton(captured.system)}\n${toolsSource}`,
    );
    const shapeKey = hashString(
      `${resolution.modelId ?? resolution.raw}\n${skeleton(maskedSystem)}\n${toolsSource}`,
    );
    diagnostics.add(t, rawShapeKey, shapeKey, maskedSystem);
    const diagnostic = diagnostics.diagnose(t);
    if (diagnostic) health.emit({ kind: 'shape-churn', diagnostic });

    // Workflow traffic and maturity are deliberately independent of shape analysis. A changing
    // prompt cannot reset observation progress or hide that an instrumentation point is healthy.
    traffic.add(
      t,
      captured.observedOutputTokens,
      (captured.observedCacheReadTokens ?? 0) > 0,
    );

    let record = shapes.get(shapeKey);
    if (record) {
      // Touch for LRU recency.
      shapes.delete(shapeKey);
      shapes.set(shapeKey, record);
    } else {
      record = {
        state: new ShapeState(),
        modelId: resolution.modelId,
        rawModel: resolution.raw,
        toolsSource,
        lastAnalysisSignature: null,
        lastEmittedWorkload: null,
        lastEmitAt: 0,
        lastMaturitySignature: null,
      };
      shapes.set(shapeKey, record);
      evictIfNeeded();
    }

    record.state.observe(maskedSystem);

    // An unmappable model can't be priced. Surface it once, then stop repeating for this shape.
    if (record.modelId == null) {
      if (record.lastAnalysisSignature !== 'unknown-model') {
        record.lastAnalysisSignature = 'unknown-model';
        emit({ kind: 'unknown-model', shapeKey, rawModel: record.rawModel, operations: operational.context });
        health.emit({ kind: 'unknown-model', modelHash: hashString(record.rawModel) });
      }
      return;
    }

    const stableSystem = record.state.stableSystem();
    const measured = traffic.measure(t);
    health.emit({ kind: 'maturity', maturity: measured.maturity });
    const analysisSignature = hashString(`${record.modelId}\n${stableSystem}\n${record.toolsSource}`);
    const maturitySignature = `${measured.maturity.state}:${Math.floor(measured.maturity.progress.overall * 4)}`;

    const shapeChanged = record.lastAnalysisSignature !== analysisSignature;
    const workloadChanged =
      record.lastEmittedWorkload != null &&
      workloadChangedMaterially(record.lastEmittedWorkload, measured.workload);
    const intervalElapsed = t - record.lastEmitAt >= reauditIntervalMs;
    const firstSight = record.lastAnalysisSignature == null;
    const maturityChanged = record.lastMaturitySignature !== maturitySignature;

    if (!(firstSight || shapeChanged || workloadChanged || maturityChanged || intervalElapsed)) return;

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
      health.emit({ kind: 'analysis', status: 'failed', shapeHash: shapeKey });
      return;
    }

    record.lastAnalysisSignature = analysisSignature;
    record.lastEmittedWorkload = measured.workload;
    record.lastEmitAt = t;
    record.lastMaturitySignature = maturitySignature;

    const portableReport = toReportEnvelope(result, {
      workflow: {
        id: operational.context.workflow.id,
        ...(operational.portableEnvironment ? { environment: operational.portableEnvironment } : {}),
      },
      release: {
        id: operational.portableReleaseId,
        ...(operational.portableDeployedAt ? { deployedAt: operational.portableDeployedAt } : {}),
      },
      provenance: {
        producer: '@savedyouatoken/sdk',
        producerVersion: SDK_VERSION,
        generatedAt: new Date(t).toISOString(),
      },
      maturity: { state: measured.maturity.state, observations: measured.observations },
      window: {
        startedAt: new Date(measured.startedAt).toISOString(),
        endedAt: new Date(measured.endedAt).toISOString(),
        requests: measured.observations,
      },
      engineVersion: ANALYSIS_ENGINE_VERSION,
      rulesetId: RULESET_ID,
    });
    emit({
      kind: 'analysis',
      shapeKey,
      result,
      report: toSharedReport(result),
      portableReport,
      operations: operational.context,
      maturity: measured.maturity,
      matured: measured.matured,
    });
    health.emit({ kind: 'analysis', status: 'completed', shapeHash: shapeKey });
  }

  function evictIfNeeded(): void {
    while (shapes.size > maxShapes) {
      const oldest = shapes.keys().next().value;
      if (oldest === undefined) break;
      shapes.delete(oldest);
    }
  }

  function notifyUnsupportedMethod(method: string): void {
    health.emit({ kind: 'unsupported-method', method });
  }

  return { observe, notifyUnsupportedMethod };
}

function resolveSinks(options: AuditorOptions, env: string): AuditSink[] {
  if (options.sinks && options.sinks.length) return options.sinks;
  if (options.sink) return [options.sink];
  return [env === 'production' ? noopSink : consoleSink()];
}

export type { WorkloadOverrides };
