import type {
  MaturityReasonCode,
  MaturityThresholds,
  MeasurementStatus,
  Workload,
  WorkloadOverrides,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Observation {
  t: number;
  outputTokens?: number;
  cacheHit: boolean;
}

export interface MeasuredWorkload {
  workload: Workload;
  /** Whether the request-rate estimate is backed by enough observations and elapsed time. */
  matured: boolean;
  maturity: MeasurementStatus;
  observations: number;
  startedAt: number;
  endedAt: number;
}

export interface TrafficConfig {
  windowMs: number;
  maturity: MaturityThresholds;
  overrides: WorkloadOverrides;
}

/**
 * A rolling window of observations for one shape, turned into a `Workload` on demand.
 *
 * Kept deliberately separate from shape analysis: analysing a shape once on first sight would
 * freeze its projection at ~one request. Collection runs on every observation; the auditor
 * asks for the current estimate whenever it decides to emit, so a report always reflects the
 * accumulated window rather than the first request. Overrides pin any field the caller would
 * rather state than measure.
 */
export class TrafficWindow {
  private obs: Observation[] = [];

  constructor(private readonly config: TrafficConfig) {}

  add(now: number, outputTokens: number | undefined, cacheHit: boolean): void {
    this.obs.push({ t: now, outputTokens, cacheHit });
    this.prune(now);
  }

  private prune(now: number): void {
    const cutoff = now - this.config.windowMs;
    if (this.obs.length && this.obs[0]!.t < cutoff) {
      this.obs = this.obs.filter((o) => o.t >= cutoff);
    }
  }

  private measuredRequestsPerDay(now: number): number {
    this.prune(now);
    const n = this.obs.length;
    if (n === 0) return 0;
    const earliest = this.obs[0]!.t;
    const spanMs = now - earliest;
    if (spanMs <= 0) return 0;
    const spanDays = spanMs / DAY_MS;
    return n / spanDays;
  }

  private trafficStability(): number {
    if (this.obs.length < 3) return 0;
    const intervals = this.obs.slice(1).map((item, index) => item.t - this.obs[index]!.t);
    const midpoint = Math.ceil(intervals.length / 2);
    const first = average(intervals.slice(0, midpoint));
    const second = average(intervals.slice(midpoint));
    if (first == null || second == null) return 0;
    if (first === second) return 1;
    if (first === 0 || second === 0) return 0;
    return Math.min(first, second) / Math.max(first, second);
  }

  private measuredOutputTokens(): number | undefined {
    const withOutput = this.obs.filter((o) => o.outputTokens != null);
    if (!withOutput.length) return undefined;
    const sum = withOutput.reduce((acc, o) => acc + (o.outputTokens ?? 0), 0);
    return sum / withOutput.length;
  }

  private measuredCacheHitRate(): number | undefined {
    if (!this.obs.length) return undefined;
    const hits = this.obs.reduce((acc, o) => acc + (o.cacheHit ? 1 : 0), 0);
    return hits / this.obs.length;
  }

  /** Build the workload to price against right now, honouring overrides. */
  measure(now: number): MeasuredWorkload {
    const o = this.config.overrides;

    this.prune(now);
    const observations = this.obs.length;
    const startedAt = this.obs[0]?.t ?? now;
    const elapsedMs = Math.max(0, now - startedAt);
    const trafficStability = o.requestsPerDay != null ? 1 : this.trafficStability();
    const thresholds: MaturityThresholds = o.requestsPerDay != null
      ? { minObservations: 0, minWindowMs: 0, minTrafficStability: 0 }
      : this.config.maturity;
    const reasons: MaturityReasonCode[] = [];
    if (observations < thresholds.minObservations) reasons.push('insufficient-observations');
    if (elapsedMs < thresholds.minWindowMs) reasons.push('insufficient-window');
    if (trafficStability < thresholds.minTrafficStability) reasons.push('unstable-traffic');
    const matured = reasons.length === 0;
    const progress = {
      observations: progressRatio(observations, thresholds.minObservations),
      window: progressRatio(elapsedMs, thresholds.minWindowMs),
      trafficStability: progressRatio(trafficStability, thresholds.minTrafficStability),
      overall: 0,
    };
    progress.overall = Math.min(progress.observations, progress.window, progress.trafficStability);

    const rate = this.measuredRequestsPerDay(now);
    const requestsPerDay = o.requestsPerDay ?? (matured && rate > 0 ? rate : DEFAULT_REQUESTS_PER_DAY);

    const outputTokens = o.outputTokens ?? this.measuredOutputTokens() ?? DEFAULT_OUTPUT_TOKENS;
    const cacheHitRate = o.cacheHitRate ?? this.measuredCacheHitRate() ?? 0;

    return {
      matured,
      maturity: {
        state: matured ? 'mature' : 'provisional',
        observations,
        elapsedMs,
        trafficStability: rounded(trafficStability),
        thresholds,
        progress: {
          observations: rounded(progress.observations),
          window: rounded(progress.window),
          trafficStability: rounded(progress.trafficStability),
          overall: rounded(progress.overall),
        },
        reasons,
      },
      observations,
      startedAt,
      endedAt: now,
      workload: {
        requestsPerDay,
        outputTokens,
        cacheHitRate,
        cacheTtl: o.cacheTtl ?? '5m',
        batch: o.batch ?? false,
      },
    };
  }
}

// Placeholders used only until a shape's traffic matures. Chosen to be obviously provisional
// rather than to flatter the numbers; the matured re-emit replaces them with measurements.
export const DEFAULT_REQUESTS_PER_DAY = 1000;
export const DEFAULT_OUTPUT_TOKENS = 500;

/** Whether two workloads differ enough to be worth re-emitting a shape's report. */
export function workloadChangedMaterially(a: Workload, b: Workload): boolean {
  return (
    ratioChanged(a.requestsPerDay, b.requestsPerDay, 0.2) ||
    ratioChanged(a.outputTokens, b.outputTokens, 0.2) ||
    Math.abs(a.cacheHitRate - b.cacheHitRate) > 0.1 ||
    a.cacheTtl !== b.cacheTtl ||
    a.batch !== b.batch
  );
}

function ratioChanged(from: number, to: number, tolerance: number): boolean {
  if (from === to) return false;
  if (from === 0) return to !== 0;
  return Math.abs(to - from) / from > tolerance;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function progressRatio(actual: number, target: number): number {
  return target <= 0 ? 1 : Math.max(0, Math.min(1, actual / target));
}

function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
