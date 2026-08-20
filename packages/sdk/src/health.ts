import type { HealthDestination, HealthEvent } from './types';

type WithoutHealthBase<T> = T extends unknown
  ? Omit<T, 'at' | 'provider' | 'workflowId' | 'suppressed'>
  : never;
export type HealthSignal = WithoutHealthBase<HealthEvent>;

const scheduleMacrotask: (callback: () => void) => void =
  typeof setImmediate === 'function'
    ? (callback) => void setImmediate(callback)
    : (callback) => void setTimeout(callback, 0);

/** Deferred, non-throwing, deduplicated delivery for prompt-free health signals. */
export class HealthDispatcher {
  private readonly conditions = new Map<string, { emittedAt: number; suppressed: number }>();

  constructor(
    private readonly destination: HealthDestination | undefined,
    private readonly provider: string,
    private readonly workflowId: string,
    private readonly now: () => number,
    private readonly rateLimitMs: number,
  ) {}

  emit(signal: HealthSignal, force = false): void {
    if (!this.destination) return;
    try {
      const at = this.now();
      const key = healthConditionKey(signal);
      const previous = this.conditions.get(key);
      if (!force && previous && at - previous.emittedAt < this.rateLimitMs) {
        previous.suppressed++;
        return;
      }
      const suppressed = previous?.suppressed ?? 0;
      this.conditions.set(key, { emittedAt: at, suppressed: 0 });
      const event = {
        ...signal,
        at: new Date(at).toISOString(),
        provider: this.provider,
        workflowId: this.workflowId,
        ...(suppressed ? { suppressed } : {}),
      } as HealthEvent;
      scheduleMacrotask(() => {
        try {
          Promise.resolve(this.destination!.emit(event)).catch(() => {});
        } catch {
          // Health instrumentation can never become an application failure.
        }
      });
    } catch {
      // Invalid clocks or unexpected diagnostic values remain isolated as well.
    }
  }
}

function healthConditionKey(signal: HealthSignal): string {
  switch (signal.kind) {
    case 'initialization': return `${signal.kind}:${signal.status}`;
    case 'capture': return `${signal.kind}:${signal.status}:${signal.code ?? ''}`;
    case 'unsupported-method': return `${signal.kind}:${signal.method}`;
    case 'unknown-model': return `${signal.kind}:${signal.modelHash}`;
    case 'analysis': return `${signal.kind}:${signal.status}:${signal.shapeHash}`;
    case 'sink-delivery': return `${signal.kind}:${signal.sinkIndex}:${signal.status}`;
    case 'maturity': {
      const bucket = Math.floor(signal.maturity.progress.overall * 4);
      return `${signal.kind}:${signal.maturity.state}:${signal.maturity.reasons.join(',')}:${bucket}`;
    }
    case 'shape-churn': return `${signal.kind}:${signal.diagnostic.classification}`;
  }
}
