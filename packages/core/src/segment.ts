import type { BlockInfo, Range, ToolLike } from './types';

/** Find fenced code blocks so whitespace-sensitive rules can leave them alone. */
export function findCodeRanges(prompt: string): Range[] {
  const ranges: Range[] = [];
  const fence = /^([ \t]*)(```|~~~)[^\n]*\n([\s\S]*?)^[ \t]*\2[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(prompt)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

export function inAnyRange(pos: number, ranges: Range[]): boolean {
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

const VARIABLE_PATTERNS: Array<[RegExp, string]> = [
  [/\{\{\s*[\w.\-[\]]{1,60}\s*\}\}/, 'a {{template}} variable'],
  [/\$\{\s*[\w.\-[\]]{1,60}\s*\}/, 'a ${template} variable'],
  [/%\(\w{1,40}\)s/, 'a %(named)s format placeholder'],
  [/<\|?\s*(user_input|user_query|question|context|documents?|history|transcript|input)\s*\|?>/i, 'an input placeholder tag'],
  [/\[(USER_INPUT|INPUT|QUERY|CONTEXT|DOCUMENT|HISTORY)\]/, 'an input placeholder'],
  [/\b(today'?s date is|current date|the current time|as of \d{4}-\d{2}-\d{2})/i, 'a date that changes per request'],
  [/\b\d{4}-\d{2}-\d{2}\b/, 'a hard-coded date'],
];

/** Single-brace `{name}` is only treated as a variable outside JSON-looking text. */
const SINGLE_BRACE = /\{[a-zA-Z_][a-zA-Z0-9_]{0,40}\}/;

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!/[{[]/.test(trimmed)) return false;
  return /"\s*:\s*/.test(trimmed) || /^\s*[{[]/.test(trimmed);
}

export function classifyDynamic(text: string): { dynamic: boolean; reason?: string } {
  for (const [re, reason] of VARIABLE_PATTERNS) {
    if (re.test(text)) return { dynamic: true, reason };
  }
  if (!looksLikeJson(text) && SINGLE_BRACE.test(text)) {
    return { dynamic: true, reason: 'a {name} format placeholder' };
  }
  return { dynamic: false };
}

/**
 * Split the prompt into blocks on blank lines. Blocks are the unit the caching rules
 * reason about, because a cache breakpoint can only sit on a block boundary in practice.
 */
export function splitBlocks(prompt: string, codeRanges: Range[]): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  const separator = /\n[ \t]*\n+/g;
  let cursor = 0;
  let m: RegExpExecArray | null;

  const push = (start: number, end: number) => {
    const text = prompt.slice(start, end);
    if (!text.trim()) return;
    const { dynamic, reason } = classifyDynamic(text);
    blocks.push({
      start,
      end,
      text,
      dynamic,
      dynamicReason: reason,
      fenced: codeRanges.some((r) => start >= r.start && end <= r.end),
    });
  };

  while ((m = separator.exec(prompt)) !== null) {
    // Don't split inside a fenced code block: it is one logical unit.
    if (inAnyRange(m.index, codeRanges)) continue;
    push(cursor, m.index);
    cursor = m.index + m[0].length;
  }
  push(cursor, prompt.length);
  return blocks;
}

/**
 * Parse tool/function definitions from pasted JSON. Accepts an array of tools, a single
 * tool object, or an OpenAI-style `{"tools": [...]}` wrapper. Returns [] on anything
 * unparseable rather than throwing — a bad paste should not break the analysis.
 */
export function parseTools(source: string): ToolLike[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  let list: unknown[] = [];
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.tools)) list = obj.tools;
    else if (Array.isArray(obj.functions)) list = obj.functions;
    else list = [parsed];
  }

  const tools: ToolLike[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    // OpenAI wraps the real definition in { type: 'function', function: {...} }.
    const inner = (obj.function && typeof obj.function === 'object' ? obj.function : obj) as Record<
      string,
      unknown
    >;
    const name = typeof inner.name === 'string' ? inner.name : '(unnamed)';
    const description = typeof inner.description === 'string' ? inner.description : undefined;
    const raw = JSON.stringify(item);
    const start = source.indexOf(`"${name}"`);
    tools.push({
      name,
      description,
      raw,
      start: start >= 0 ? start : 0,
      end: start >= 0 ? start + name.length + 2 : 0,
    });
  }
  return tools;
}

/**
 * Find balanced `{...}` / `[...]` spans, respecting string literals so a brace inside a
 * quoted value does not throw the depth count off. Returns candidates in document order;
 * nested spans are skipped because the outermost one is the useful unit.
 */
export function findBalancedSpans(text: string, maxSpanChars = 200_000): Range[] {
  const out: Range[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    // Cheap gate: real JSON opens onto whitespace and then a quote, brace or bracket.
    if (!/^[{[]\s*["{[\]}]/.test(text.slice(i, i + 8))) continue;
    const end = matchBalanced(text, i, maxSpanChars);
    if (end === -1) continue;
    out.push({ start: i, end });
    i = end - 1;
  }
  return out;
}

function matchBalanced(text: string, start: number, maxSpanChars: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(text.length, start + maxSpanChars);

  for (let i = start; i < limit; i++) {
    const c = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

/** Sentences, for duplicate detection. Cheap and good enough for prompt text. */
export function splitSentences(text: string): Range[] {
  const out: Range[] = [];
  const re = /[^.!?\n]+[.!?]*(?:\n|$)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[0].trim()) continue;
    out.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** Normalise a line for similarity comparison: lowercase, strip punctuation and markers. */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[\s\-*•\d.)]+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard similarity over word sets. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = new Set(a.split(' '));
  const sb = new Set(b.split(' '));
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared++;
  const union = sa.size + sb.size - shared;
  return union === 0 ? 0 : shared / union;
}
