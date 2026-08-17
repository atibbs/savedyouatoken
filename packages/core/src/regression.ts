import { type ComparisonCompatibility, type ReportEnvelope, classifyReportCompatibility } from './contracts';

export interface DeltaField {
  baseline: number;
  current: number;
  delta: number;
  /** null when the baseline value is zero, since a percentage change is undefined. */
  percent: number | null;
}

export type FindingDiffStatus = 'new' | 'resolved' | 'unchanged' | 'changed';

export interface FindingDiffEntry {
  ruleId: string;
  status: FindingDiffStatus;
  baseline: { severity: string; occurrences: number; tokensSaved: number; monthlySaving: number } | null;
  current: { severity: string; occurrences: number; tokensSaved: number; monthlySaving: number } | null;
}

/**
 * A priced comparison between two reports. When `compatibility.status` is `invalid`, only
 * `compatibility` is populated — the numbers below are never compared across an incompatible
 * major, workflow, currency, or model, since the arithmetic would be meaningless.
 *
 * `findings` is deliberately not summed into an extra "total savings" figure: each entry's
 * `monthlySaving` describes what that rule alone would save against the *unoptimized* prompt it
 * was measured on, and those figures overlap by construction (removing one block of waste can
 * change the token count another finding's saving was computed against). The only trustworthy
 * aggregate cost deltas are `cost.monthlyNow` and `cost.monthlyAfterRewrite`, computed directly
 * from each report's exact totals.
 */
export interface ReportDiff {
  compatibility: ComparisonCompatibility;
  tokens?: {
    promptTokens: DeltaField;
    toolTokens: DeltaField;
    inputTokens: DeltaField;
    optimizedTokens: DeltaField;
  };
  cost?: {
    monthlyNow: DeltaField;
    monthlyAfterRewrite: DeltaField;
    cacheSaving: DeltaField;
  };
  findings?: FindingDiffEntry[];
}

export function diffReports(baseline: ReportEnvelope, current: ReportEnvelope): ReportDiff {
  const compatibility = classifyReportCompatibility(baseline, current);
  if (compatibility.status === 'invalid') return { compatibility };

  return {
    compatibility,
    tokens: {
      promptTokens: delta(baseline.analysis.promptTokens, current.analysis.promptTokens),
      toolTokens: delta(baseline.analysis.toolTokens, current.analysis.toolTokens),
      inputTokens: delta(baseline.analysis.inputTokens, current.analysis.inputTokens),
      optimizedTokens: delta(baseline.analysis.optimizedTokens, current.analysis.optimizedTokens),
    },
    cost: {
      monthlyNow: delta(baseline.analysis.monthlyNow, current.analysis.monthlyNow),
      monthlyAfterRewrite: delta(baseline.analysis.monthlyAfterRewrite, current.analysis.monthlyAfterRewrite),
      cacheSaving: delta(baseline.analysis.cacheSaving, current.analysis.cacheSaving),
    },
    findings: diffFindings(baseline, current),
  };
}

function diffFindings(baseline: ReportEnvelope, current: ReportEnvelope): FindingDiffEntry[] {
  const byRule = new Map<string, FindingDiffEntry>();
  for (const finding of baseline.analysis.findings) {
    byRule.set(finding.ruleId, {
      ruleId: finding.ruleId,
      status: 'resolved',
      baseline: {
        severity: finding.severity,
        occurrences: finding.occurrences,
        tokensSaved: finding.tokensSaved,
        monthlySaving: finding.monthlySaving,
      },
      current: null,
    });
  }
  for (const finding of current.analysis.findings) {
    const existing = byRule.get(finding.ruleId);
    const currentSide = {
      severity: finding.severity,
      occurrences: finding.occurrences,
      tokensSaved: finding.tokensSaved,
      monthlySaving: finding.monthlySaving,
    };
    if (!existing) {
      byRule.set(finding.ruleId, { ruleId: finding.ruleId, status: 'new', baseline: null, current: currentSide });
      continue;
    }
    const unchanged =
      existing.baseline!.severity === currentSide.severity &&
      existing.baseline!.occurrences === currentSide.occurrences &&
      existing.baseline!.tokensSaved === currentSide.tokensSaved &&
      existing.baseline!.monthlySaving === currentSide.monthlySaving;
    existing.current = currentSide;
    existing.status = unchanged ? 'unchanged' : 'changed';
  }
  return [...byRule.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function delta(baselineValue: number, currentValue: number): DeltaField {
  return {
    baseline: baselineValue,
    current: currentValue,
    delta: currentValue - baselineValue,
    percent: baselineValue === 0 ? null : ((currentValue - baselineValue) / baselineValue) * 100,
  };
}
