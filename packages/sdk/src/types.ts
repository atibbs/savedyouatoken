import type { AnalysisResult, ReportEnvelope, SharedReport, TokenCounter, Workload } from '@savedyouatoken/core';

/**
 * The normalised, provider-agnostic view of one captured request. Only the static, repeated
 * scaffold — model, system prompt, tool definitions — plus whatever the response told us about
 * cost is retained. Per-request variable content (user turns, retrieved context) is not part
 * of this shape; it is not what the audit is about.
 */
export interface CapturedRequest {
  /** The raw model identifier exactly as the caller sent it (may be a dated snapshot). */
  model: string;
  /** The assembled system / developer prompt text. */
  system: string;
  /** Raw tool/function definitions as the provider received them, if any. */
  tools?: unknown[];
  /** Completion length reported by the response, when available (omitted for streams). */
  observedOutputTokens?: number;
  /** Cached input tokens reported by the response, when available. */
  observedCacheReadTokens?: number;
  /** Total input tokens reported by the response, when available. */
  observedInputTokens?: number;
  /** When the request was observed (ms since epoch). */
  timestamp: number;
}

/**
 * A pure function that reads a provider's request (and optional response) shape structurally
 * and returns the normalised capture, or `null` if the input is not a recognisable request.
 * Adapters never import a provider SDK — they duck-type the shape — so the package is immune
 * to provider-SDK version bumps.
 */
export interface RequestAdapter {
  readonly provider: string;
  extract(params: unknown, response?: unknown): CapturedRequest | null;
}

/** Runtime-enforced bounds for metadata that may leave the process through configured sinks. */
export const OPERATIONAL_METADATA_LIMITS = {
  workflowName: 80,
  identifier: 128,
  tagKey: 40,
  tagValue: 120,
  tagCount: 10,
  tagBytes: 1024,
} as const;

export interface WorkflowConfiguration {
  /** Required, human-readable instrumentation point, e.g. `support-triage`. */
  name: string;
  /** Optional caller-owned stable id. Generated deterministically from name/service when omitted. */
  id?: string;
  environment?: string;
  service?: string;
  /** Small allowlisted scalar labels. Invalid or excessive entries are omitted and diagnosed. */
  tags?: Record<string, string>;
}

export interface ReleaseConfiguration {
  version?: string;
  commit?: string;
  deployment?: string;
  deployedAt?: string;
}

export type MaturityReasonCode =
  | 'insufficient-observations'
  | 'insufficient-window'
  | 'unstable-traffic';

export interface MaturityThresholds {
  minObservations: number;
  minWindowMs: number;
  minTrafficStability: number;
}

export interface MaturityProgress {
  observations: number;
  window: number;
  trafficStability: number;
  overall: number;
}

export interface MeasurementStatus {
  state: 'provisional' | 'mature';
  observations: number;
  elapsedMs: number;
  trafficStability: number;
  thresholds: MaturityThresholds;
  progress: MaturityProgress;
  reasons: MaturityReasonCode[];
}

export interface ShapeDiagnosticsConfiguration {
  /** Minimum observations before churn can be diagnosed. Default 10. */
  minObservations?: number;
  /** Minimum distinct effective shapes before churn can be diagnosed. Default 5. */
  minUniqueShapes?: number;
  /** Unique-shape / observation ratio that triggers a diagnostic. Default 0.5. */
  churnRatio?: number;
  /** Rolling diagnostic window. Defaults to the traffic window. */
  windowMs?: number;
}

export interface ShapeChurnDiagnostic {
  classification: 'excessive-shape-churn';
  observations: number;
  uniqueShapes: number;
  rawUniqueShapes: number;
  churnRatio: number;
  maskConfigured: boolean;
  maskCollapseRatio: number;
  /** Zero-based line positions whose prompt-safe hashes vary across observations. */
  variableLinePositions: number[];
}

export type MetadataRejectionReason =
  | 'missing'
  | 'invalid-type'
  | 'invalid-format'
  | 'too-long'
  | 'too-many-tags'
  | 'tag-payload-too-large';

export interface MetadataRejection {
  /** Allowlisted field path only; the rejected value is never retained or emitted. */
  field: string;
  reason: MetadataRejectionReason;
}

export interface ComparisonProvenance {
  contractVersion: { major: number; minor: number };
  sdkVersion: string;
  engineVersion: string;
  rulesetId: string;
  modelCatalogueDate: string;
}

export interface OperationalContext {
  workflow: {
    id: string;
    name: string;
    environment?: string;
    service?: string;
    tags?: Record<string, string>;
  };
  release: ReleaseConfiguration;
  comparison: ComparisonProvenance;
  /** `legacy` means the deprecated `reportContext`/implicit path supplied identity. */
  configurationMode: 'configured' | 'legacy';
}

interface HealthEventBase {
  at: string;
  provider: string;
  workflowId: string;
  /** Repeated identical conditions suppressed since the previous emitted event. */
  suppressed?: number;
}

export type HealthEvent =
  | (HealthEventBase & {
      kind: 'initialization';
      status: 'ready' | 'compatibility';
      metadataRejected?: MetadataRejection[];
    })
  | (HealthEventBase & {
      kind: 'capture';
      status: 'captured' | 'skipped' | 'failed';
      code?: 'adapter-no-match' | 'adapter-error' | 'processing-error';
    })
  | (HealthEventBase & { kind: 'unsupported-method'; method: string })
  | (HealthEventBase & { kind: 'unknown-model'; modelHash: string })
  | (HealthEventBase & { kind: 'analysis'; status: 'completed' | 'failed'; shapeHash: string })
  | (HealthEventBase & {
      kind: 'sink-delivery';
      destination: 'audit';
      sinkIndex: number;
      status: 'delivered' | 'failed';
    })
  | (HealthEventBase & { kind: 'maturity'; maturity: MeasurementStatus })
  | (HealthEventBase & { kind: 'shape-churn'; diagnostic: ShapeChurnDiagnostic });

/** A separate, prompt-free, non-throwing destination for instrumentation health. */
export interface HealthDestination {
  emit(event: HealthEvent): void | Promise<void>;
}

export interface SdkOperationsConfiguration {
  workflow: WorkflowConfiguration;
  release?: ReleaseConfiguration;
  health?: HealthDestination;
  /** Deduplication window for repeated health conditions. Default 5 minutes. */
  healthRateLimitMs?: number;
  maturity?: Partial<MaturityThresholds>;
  diagnostics?: ShapeDiagnosticsConfiguration;
}

/** The kind of thing that happened, delivered to a sink. */
export type AuditEvent =
  | {
      kind: 'analysis';
      shapeKey: string;
      /** Full in-process result. Contains prompt-derived text — never transmit it off-process. */
      result: AnalysisResult;
      /** Prompt- and tool-text-free projection, safe to transmit off-process. */
      report: SharedReport;
      /** Versioned prompt-free interchange report. Additive; legacy `report` remains supported. */
      portableReport: ReportEnvelope;
      /** Bounded workflow/release identity and comparison provenance. */
      operations: OperationalContext;
      /** Deterministic maturity progress and machine-readable provisional reasons. */
      maturity: MeasurementStatus;
      /** Whether the workload behind this report is measured from matured traffic. */
      matured: boolean;
    }
  | {
      kind: 'unknown-model';
      shapeKey: string;
      /** The model identifier that could not be mapped to a catalogue model. */
      rawModel: string;
      operations: OperationalContext;
    };

/** A destination for audit results. In-process by default; nothing leaves unless configured. */
export interface AuditSink {
  emit(event: AuditEvent): void | Promise<void>;
}

/** Caller-tunable overrides for the measured workload. Any field left unset is measured. */
export type WorkloadOverrides = Partial<
  Pick<Workload, 'requestsPerDay' | 'outputTokens' | 'cacheHitRate' | 'cacheTtl' | 'batch'>
>;

export interface PortableReportContext {
  /** Stable workflow identity. Defaults to the SDK's deterministic request-shape key. */
  workflowId?: string;
  environment?: string;
  /** Deployment, commit, or release identity. Defaults to `unversioned`. */
  releaseId?: string;
  deployedAt?: string;
}

export interface AuditorOptions {
  /** Where results go. A single sink, or several. Defaults to console in dev, silence in prod. */
  sink?: AuditSink;
  sinks?: AuditSink[];
  /** Token counter. Defaults to a real o200k_base counter via `gpt-tokenizer`. */
  counter?: TokenCounter;
  /** Pin any workload field instead of measuring it from traffic. */
  workload?: WorkloadOverrides;
  /** Identity metadata attached to the portable report envelope. */
  reportContext?: PortableReportContext;
  /** Recommended production-operability configuration. Supersedes `reportContext`. */
  operations?: SdkOperationsConfiguration;
  /**
   * Mask variable regions of the system prompt before it contributes to shape identity, so a
   * per-request interpolation (tenant id, retrieved snippet) does not mint a new shape.
   */
  mask?: (system: string) => string;
  /** Clock, injectable for testing. Defaults to `Date.now`. */
  now?: () => number;
  /** Environment. Governs the default sink. Defaults to `process.env.NODE_ENV`. */
  env?: 'development' | 'production' | string;
  /** Upper bound on distinct shapes held in memory (LRU). Default 500. */
  maxShapes?: number;
  /** Rolling traffic window in ms. Default 24h. */
  trafficWindowMs?: number;
  /** Observations required before a measured workload is considered matured. Default 20. */
  minObservationsForMaturity?: number;
  /** Elapsed span required before a measured request rate is trusted. Default 5 min. */
  minSpanMsForMaturity?: number;
  /** Minimum deterministic traffic-stability ratio. Default 0.5. */
  minTrafficStabilityForMaturity?: number;
  /** Re-audit a long-lived stable shape at most this often, to catch price/tokenizer changes. Default 6h. */
  reauditIntervalMs?: number;
}

export type { AnalysisResult, ReportEnvelope, SharedReport, TokenCounter, Workload };
