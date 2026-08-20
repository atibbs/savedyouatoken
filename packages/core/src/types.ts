import type { Model } from './models';
import type { Workload } from './cost';

export interface Range {
  start: number;
  end: number;
}

export interface Edit extends Range {
  replacement: string;
}

export type Severity = 'high' | 'medium' | 'low';

export type Category = 'filler' | 'formatting' | 'structure' | 'caching' | 'schema' | 'model';

export const CATEGORY_LABELS: Record<Category, string> = {
  filler: 'Filler',
  formatting: 'Formatting',
  structure: 'Structure',
  caching: 'Caching',
  schema: 'Tools & schemas',
  model: 'Model choice',
};

export interface BlockInfo extends Range {
  text: string;
  /** Block contains a template variable, a date, or other per-request content. */
  dynamic: boolean;
  /** Reason the block was judged dynamic, for explaining the finding. */
  dynamicReason?: string;
  fenced: boolean;
}

export interface ToolLike {
  name: string;
  description?: string;
  raw: string;
  start: number;
  end: number;
}

export interface RuleContext {
  prompt: string;
  blocks: BlockInfo[];
  /** Fenced code block ranges; whitespace-sensitive rules must not edit inside these. */
  codeRanges: Range[];
  model: Model;
  workload: Workload;
  /** Token count for the selected model's tokenizer family. */
  count(text: string): number;
  /** Parsed tool/function definitions, when the user supplied them. */
  tools: ToolLike[];
  toolsSource: string;
  /** Tokens in the minified tool schemas, plus the provider's tool-use system prompt. */
  toolTokens: number;
  /**
   * Everything billed as input on one request: prompt + tools + provider overhead.
   * Rules that reason about cost, price tiers or context pressure must use this rather
   * than counting the prompt alone — for a tool-heavy agent the prompt is the small half.
   */
  inputTokens: number;
}

export interface RuleOutput {
  /** Mechanical replacements. Empty for advisory-only rules. */
  edits?: Edit[];
  /** Extra ranges to highlight that are not themselves edits. */
  ranges?: Range[];
  occurrences: number;
  /** One sentence written for *this* prompt, not the generic rule description. */
  detail: string;
  /** For advisory rules: tokens this finding is responsible for. */
  wastedTokens?: number;
  /** For advisory rules: dollars per month this finding is responsible for. */
  monthlySaving?: number;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  category: Category;
  /** Whether the optimizer can apply this automatically. */
  autofix: boolean;
  /** Applied only when the user opts into aggressive rewriting. */
  aggressive?: boolean;
  /** Whether edits must avoid fenced code blocks. */
  respectsCodeFences?: boolean;
  /** One line, shown in the findings list. */
  summary: string;
  /** Reference-page prose. Markdown-ish plain paragraphs. */
  why: string[];
  example?: { before: string; after: string };
  detect(ctx: RuleContext): RuleOutput | null;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  autofix: boolean;
  aggressive: boolean;
  summary: string;
  detail: string;
  occurrences: number;
  ranges: Range[];
  edits: Edit[];
  /** Tokens attributed to this finding (per-edit attribution; the headline total is exact). */
  tokensSaved: number;
  monthlySaving: number;
}
