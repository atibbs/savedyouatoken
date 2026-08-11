import type { Edit, Finding, Range, RuleContext } from './types';
import type { Model } from './models';
import type { CacheSimulation, CostBreakdown, Workload } from './cost';
import type { Accuracy, TokenCounter } from './tokens';

import { MODELS, requireModel } from './models';
import { DAYS_PER_MONTH, costOf, ratesFor, simulateCache } from './cost';
import { FAMILY_LABELS } from './tokens';
import { findCodeRanges, parseTools, rangesOverlap, splitBlocks } from './segment';
import { ALL_RULES } from './rules/index';
import { editSavings } from './rules/util';

export interface AnalyzeInput {
  prompt: string;
  /** Optional JSON array of tool/function definitions. */
  toolsSource?: string;
  modelId: string;
  workload: Workload;
  counter: TokenCounter;
  /** Enable rules that delete content rather than tighten it. */
  aggressive?: boolean;
}

export interface ModelComparisonRow {
  model: Model;
  inputTokens: number;
  monthlyCost: number;
  /** Relative to the analysed model: -0.4 means 40% cheaper. */
  delta: number;
}

export interface TokenizerInfo {
  family: string;
  familyLabel: string;
  accuracy: Accuracy;
  counterName: string;
}

export interface AnalysisResult {
  model: Model;
  workload: Workload;
  tokenizer: TokenizerInfo;

  promptTokens: number;
  toolTokens: number;
  providerToolOverhead: number;
  /** Everything billed as input on a single request. */
  inputTokens: number;

  findings: Finding[];
  blocks: RuleContext['blocks'];
  codeRanges: Range[];

  optimizedPrompt: string;
  optimizedTokens: number;
  /** Exact, from re-counting the rewritten prompt. Not a sum of per-finding estimates. */
  tokensRemoved: number;
  percentRemoved: number;
  appliedEdits: Edit[];

  costNow: CostBreakdown;
  costAfterRewrite: CostBreakdown;
  monthlyRewriteSaving: number;

  /** Non-rewrite opportunities, largest first. These may overlap each other. */
  opportunities: Finding[];
  /** The single largest structural opportunity, for headline use. */
  topOpportunity: Finding | null;

  cache: CacheSimulation;
  comparison: ModelComparisonRow[];
}

/** Rebuild `text` with `edits` applied. Edits must be non-overlapping. */
export function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const e of sorted) {
    if (e.start < cursor) continue; // Defensive: skip anything that slipped through.
    out += text.slice(cursor, e.start) + e.replacement;
    cursor = e.end;
  }
  return out + text.slice(cursor);
}

/**
 * Tidy artefacts left behind by clause removal, so the rewrite reads cleanly.
 *
 * Fenced code blocks are copied through untouched. Collapsing indentation inside a code
 * block the user asked the model to reproduce verbatim would be a correctness bug, not a
 * saving — this is the one place in the pipeline that could silently corrupt content.
 */
function tidy(text: string): string {
  const fences = findCodeRanges(text);
  if (!fences.length) return tidyProse(text).trimEnd();

  let out = '';
  let cursor = 0;
  for (const range of fences) {
    out += tidyProse(text.slice(cursor, range.start));
    out += text.slice(range.start, range.end);
    cursor = range.end;
  }
  out += tidyProse(text.slice(cursor));
  return out.trimEnd();
}

function tidyProse(text: string): string {
  return (
    text
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      // Collapse interior runs only. Leading whitespace is the author's indentation — list
      // nesting, centred headings — and was not something a removal created.
      .replace(/(\S)[ \t]{2,}/g, '$1 ')
      .replace(/ ([.,;:!?])/g, '$1')
  );
}

export function analyze(input: AnalyzeInput): AnalysisResult {
  const model = requireModel(input.modelId);
  const { prompt, workload, counter } = input;
  const toolsSource = input.toolsSource ?? '';

  const count = (text: string) => counter.count(text, model.family);
  const codeRanges = findCodeRanges(prompt);
  const blocks = splitBlocks(prompt, codeRanges);
  const tools = parseTools(toolsSource);

  const promptTokens = count(prompt);
  const toolTokens = tools.length ? count(JSON.stringify(tools.map((t) => JSON.parse(t.raw)))) : 0;
  const providerToolOverhead = tools.length ? (model.toolSystemPromptTokens?.auto ?? 0) : 0;
  const inputTokens = promptTokens + toolTokens + providerToolOverhead;

  const ctx: RuleContext = {
    prompt,
    blocks,
    codeRanges,
    model,
    workload,
    count,
    tools,
    toolsSource,
    toolTokens: toolTokens + providerToolOverhead,
    inputTokens,
  };

  // ---- Run rules, resolving edit conflicts in rule order -------------------
  const findings: Finding[] = [];
  const accepted: Edit[] = [];

  for (const rule of ALL_RULES) {
    if (rule.aggressive && !input.aggressive) continue;

    let output;
    try {
      output = rule.detect(ctx);
    } catch {
      // A single misbehaving rule must not take down the whole analysis.
      continue;
    }
    if (!output) continue;

    const ruleEdits: Edit[] = [];
    for (const edit of output.edits ?? []) {
      if (rule.respectsCodeFences && codeRanges.some((r) => rangesOverlap(edit, r))) continue;
      if (accepted.some((a) => rangesOverlap(edit, a))) continue;
      if (ruleEdits.some((a) => rangesOverlap(edit, a))) continue;
      ruleEdits.push(edit);
      accepted.push(edit);
    }

    // A rule whose every edit was claimed by an earlier rule has nothing to report.
    if ((output.edits?.length ?? 0) > 0 && ruleEdits.length === 0) continue;

    const tokensSaved = ruleEdits.length
      ? editSavings(prompt, ruleEdits, count)
      : (output.wastedTokens ?? 0);

    const rates = ratesFor(model, inputTokens, workload);
    const derivedMonthly =
      (tokensSaved * rates.input * workload.requestsPerDay * DAYS_PER_MONTH) / 1_000_000;

    findings.push({
      ruleId: rule.id,
      title: rule.title,
      severity: rule.severity,
      category: rule.category,
      autofix: rule.autofix,
      aggressive: rule.aggressive ?? false,
      summary: rule.summary,
      detail: output.detail,
      occurrences: output.occurrences,
      ranges: [
        ...ruleEdits.map((e) => ({ start: e.start, end: e.end })),
        ...(output.ranges ?? []),
      ],
      edits: ruleEdits,
      tokensSaved,
      monthlySaving: output.monthlySaving ?? derivedMonthly,
    });
  }

  // ---- Rewrite -------------------------------------------------------------
  const optimizedPrompt = tidy(applyEdits(prompt, accepted));
  const optimizedTokens = count(optimizedPrompt);
  const tokensRemoved = Math.max(0, promptTokens - optimizedTokens);
  const percentRemoved = promptTokens > 0 ? (tokensRemoved / promptTokens) * 100 : 0;

  // ---- Money ---------------------------------------------------------------
  const costNow = costOf(model, 0, inputTokens, { ...workload, cacheHitRate: 0 });
  const costAfterRewrite = costOf(model, 0, inputTokens - tokensRemoved, {
    ...workload,
    cacheHitRate: 0,
  });
  const monthlyRewriteSaving = costNow.perMonth - costAfterRewrite.perMonth;

  // ---- Caching -------------------------------------------------------------
  const firstDynamic = blocks.find((b) => b.dynamic);
  const staticTokens = firstDynamic
    ? count(prompt.slice(0, firstDynamic.start)) + toolTokens
    : promptTokens + toolTokens;
  const cache = simulateCache(
    model,
    staticTokens,
    Math.max(0, inputTokens - staticTokens),
    workload.cacheHitRate > 0 ? workload : { ...workload, cacheHitRate: 0.8 },
  );

  // ---- Cross-model comparison ---------------------------------------------
  // Count once per tokenizer family rather than once per model: the expensive part is the
  // BPE pass over the prompt, and thirty-odd models share four families between them.
  const familyTokens = new Map<Model['family'], number>();
  for (const m of MODELS) {
    if (familyTokens.has(m.family)) continue;
    familyTokens.set(
      m.family,
      counter.count(prompt, m.family) + (tools.length ? counter.count(toolsSource, m.family) : 0),
    );
  }

  const comparison: ModelComparisonRow[] = MODELS.map((m) => {
    const tokens = familyTokens.get(m.family) ?? 0;
    const overhead = tools.length ? (m.toolSystemPromptTokens?.auto ?? 0) : 0;
    const monthlyCost = costOf(m, 0, tokens + overhead, { ...workload, cacheHitRate: 0 }).perMonth;
    return { model: m, inputTokens: tokens + overhead, monthlyCost, delta: 0 };
  })
    .map((row) => ({
      ...row,
      delta: costNow.perMonth > 0 ? row.monthlyCost / costNow.perMonth - 1 : 0,
    }))
    .sort((a, b) => a.monthlyCost - b.monthlyCost);

  findings.sort((a, b) => {
    if (b.monthlySaving !== a.monthlySaving) return b.monthlySaving - a.monthlySaving;
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  const opportunities = findings.filter((f) => !f.autofix && f.monthlySaving > 0);

  return {
    model,
    workload,
    tokenizer: {
      family: model.family,
      familyLabel: FAMILY_LABELS[model.family],
      accuracy: counter.accuracy(model.family),
      counterName: counter.name,
    },
    promptTokens,
    toolTokens,
    providerToolOverhead,
    inputTokens,
    findings,
    blocks,
    codeRanges,
    optimizedPrompt,
    optimizedTokens,
    tokensRemoved,
    percentRemoved,
    appliedEdits: accepted,
    costNow,
    costAfterRewrite,
    monthlyRewriteSaving,
    opportunities,
    topOpportunity: opportunities[0] ?? null,
    cache,
    comparison,
  };
}
