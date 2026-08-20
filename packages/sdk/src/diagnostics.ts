import { hashString, skeleton } from './shape';
import type { ShapeChurnDiagnostic, ShapeDiagnosticsConfiguration } from './types';

interface ShapeObservation {
  at: number;
  rawShape: string;
  effectiveShape: string;
  lineHashes: string[];
}

/** Rolling prompt-safe shape statistics. Only hashes, counts, and positions are retained. */
export class ShapeDiagnosticsTracker {
  private observations: ShapeObservation[] = [];

  constructor(
    private readonly config: Required<ShapeDiagnosticsConfiguration>,
    private readonly maskConfigured: boolean,
  ) {}

  add(at: number, rawShape: string, effectiveShape: string, maskedSystem: string): void {
    this.observations.push({
      at,
      rawShape,
      effectiveShape,
      lineHashes: skeleton(maskedSystem).split('\n').map(hashString),
    });
    this.prune(at);
    // Keep memory bounded even if a caller configures an extremely long time window.
    if (this.observations.length > 5000) this.observations.splice(0, this.observations.length - 5000);
  }

  diagnose(now: number): ShapeChurnDiagnostic | null {
    this.prune(now);
    const observations = this.observations.length;
    if (observations < this.config.minObservations) return null;
    const uniqueShapes = new Set(this.observations.map((item) => item.effectiveShape)).size;
    const rawUniqueShapes = new Set(this.observations.map((item) => item.rawShape)).size;
    const churnRatio = uniqueShapes / observations;
    if (uniqueShapes < this.config.minUniqueShapes || churnRatio < this.config.churnRatio) return null;

    const hashesByPosition = new Map<number, Set<string>>();
    for (const item of this.observations) {
      for (let index = 0; index < item.lineHashes.length; index++) {
        let hashes = hashesByPosition.get(index);
        if (!hashes) {
          hashes = new Set();
          hashesByPosition.set(index, hashes);
        }
        hashes.add(item.lineHashes[index]!);
      }
    }

    return {
      classification: 'excessive-shape-churn',
      observations,
      uniqueShapes,
      rawUniqueShapes,
      churnRatio: rounded(churnRatio),
      maskConfigured: this.maskConfigured,
      maskCollapseRatio: rawUniqueShapes
        ? rounded(Math.max(0, 1 - uniqueShapes / rawUniqueShapes))
        : 0,
      variableLinePositions: [...hashesByPosition.entries()]
        .filter(([, hashes]) => hashes.size > 1)
        .map(([index]) => index)
        .slice(0, 20),
    };
  }

  private prune(now: number): void {
    const cutoff = now - this.config.windowMs;
    if (this.observations[0]?.at != null && this.observations[0].at < cutoff) {
      this.observations = this.observations.filter((item) => item.at >= cutoff);
    }
  }
}

function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
