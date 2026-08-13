import type { AnalysisResult, SharedReport, TokenCounter, Workload } from '@savedyouatoken/core';

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

/** The kind of thing that happened, delivered to a sink. */
export type AuditEvent =
  | {
      kind: 'analysis';
      shapeKey: string;
      /** Full in-process result. Contains prompt-derived text — never transmit it off-process. */
      result: AnalysisResult;
      /** Prompt- and tool-text-free projection, safe to transmit off-process. */
      report: SharedReport;
      /** Whether the workload behind this report is measured from matured traffic. */
      matured: boolean;
    }
  | {
      kind: 'unknown-model';
      shapeKey: string;
      /** The model identifier that could not be mapped to a catalogue model. */
      rawModel: string;
    };

/** A destination for audit results. In-process by default; nothing leaves unless configured. */
export interface AuditSink {
  emit(event: AuditEvent): void | Promise<void>;
}

/** Caller-tunable overrides for the measured workload. Any field left unset is measured. */
export type WorkloadOverrides = Partial<
  Pick<Workload, 'requestsPerDay' | 'outputTokens' | 'cacheHitRate' | 'cacheTtl' | 'batch'>
>;

export interface AuditorOptions {
  /** Where results go. A single sink, or several. Defaults to console in dev, silence in prod. */
  sink?: AuditSink;
  sinks?: AuditSink[];
  /** Token counter. Defaults to a real o200k_base counter via `gpt-tokenizer`. */
  counter?: TokenCounter;
  /** Pin any workload field instead of measuring it from traffic. */
  workload?: WorkloadOverrides;
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
  /** Re-audit a long-lived stable shape at most this often, to catch price/tokenizer changes. Default 6h. */
  reauditIntervalMs?: number;
}

export type { AnalysisResult, SharedReport, TokenCounter, Workload };
