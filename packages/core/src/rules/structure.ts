import type { Edit, Range, Rule } from '../types';
import { findBalancedSpans, normalizeForCompare, similarity } from '../segment';
import { pluralize, scan } from './util';

/* ------------------------------------------------------------ said twice */

export const redundantRepetition: Rule = {
  id: 'redundant-repetition',
  title: 'The same rule, stated twice',
  severity: 'high',
  category: 'structure',
  autofix: true,
  aggressive: true,
  respectsCodeFences: true,
  summary: 'Prompts grow by accretion. Instructions get re-added rather than edited.',
  why: [
    'This is the single most common expensive problem in a mature prompt, and it is invisible from inside. A rule gets added in January. In March somebody hits the same failure, cannot find the existing rule in four hundred lines, and adds it again in different words. By August the prompt says "always cite sources" in five places.',
    'The cost is duplicated tokens on every request. The subtler cost is that near-duplicate instructions drift apart over time until they contradict each other, and then the model has to pick a winner.',
    'Deduplicating is the highest-value edit available, but it is the one you should review by hand. Two sentences that look alike to a similarity metric occasionally differ in a way that matters, so this rule is off by default and only runs when you ask for an aggressive rewrite.',
  ],
  example: {
    before: 'Always cite your sources.\n...\nRemember to always cite your sources when answering.',
    after: 'Always cite your sources.',
  },
  detect(ctx) {
    const lines: Array<{ start: number; end: number; norm: string }> = [];
    let offset = 0;
    for (const raw of ctx.prompt.split('\n')) {
      const norm = normalizeForCompare(raw);
      // Short lines are headings and list scaffolding; comparing them creates false hits.
      if (norm.split(' ').length >= 6) {
        lines.push({ start: offset, end: offset + raw.length, norm });
      }
      offset += raw.length + 1;
      if (lines.length > 2000) break;
    }

    const edits: Edit[] = [];
    const seen: typeof lines = [];
    for (const line of lines) {
      const duplicate = seen.find((s) => similarity(s.norm, line.norm) >= 0.8);
      if (duplicate) {
        // Remove the line and its newline.
        edits.push({ start: line.start, end: Math.min(line.end + 1, ctx.prompt.length), replacement: '' });
      } else {
        seen.push(line);
      }
    }

    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'line')} repeat an instruction stated earlier in the prompt.`,
    };
  },
};

/* ---------------------------------------------------------- few-shot bloat */

/**
 * Explicit example headers. Tried first, because a prompt that labels its examples also
 * labels the Input/Output lines inside them — counting both would double every example.
 */
const EXAMPLE_HEADERS = /^[ \t]*(?:<example[^>]*>|#{1,4}[ \t]*Example|\*{0,2}Example\s*#?\d*\*{0,2}\s*[:.)])/gim;

/** Fallback for prompts that show examples as bare Input/Output or Q/A pairs. */
const EXAMPLE_PAIRS = /^[ \t]*(?:Input\s*#?\d*\s*:|Q\s*#?\d*\s*:|User\s*#?\d*\s*:)/gim;

/** Examples past this count rarely change behaviour and are priced as excess. */
const KEEP_EXAMPLES = 3;

export const fewShotBloat: Rule = {
  id: 'few-shot-bloat',
  title: 'More examples than the model needs',
  severity: 'high',
  category: 'structure',
  autofix: false,
  summary: 'Few-shot examples are the most expensive content in most prompts, and they have a ceiling.',
  why: [
    'Examples work. They are also, per token, the most expensive thing in a prompt: a single realistic input/output pair for a document-extraction task can run several hundred tokens, and they are re-sent on every request forever.',
    'The returns fall off a cliff. For most classification and formatting tasks on a current model, the jump from zero to two examples is large, two to four is small, and beyond about five is usually noise. Prompts routinely carry twelve because each new edge case was fixed by adding another example rather than by fixing the instruction.',
    'The right test is empirical and cheap: drop the last half of your examples and run your eval. If accuracy holds, you just cut your input bill substantially. If it drops, you learned which examples were load-bearing.',
    'If examples must stay, they are ideal cache content — they never change between requests, so putting them in a cached prefix moves them from full price to a tenth of it.',
  ],
  example: {
    before: '9 worked examples, 2,400 tokens, sent on every request.',
    after: '3 worked examples covering the distinct cases, 800 tokens — ideally cached.',
  },
  detect(ctx) {
    const toRange = (m: RegExpExecArray) => ({
      start: m.index,
      end: m.index + m[0].length,
      replacement: m[0]!,
    });

    // Prefer labelled examples; only fall back to Input/Q pairs when there are no labels,
    // otherwise a prompt with "Example 1: / Input: / Output:" counts every example twice.
    let marks = scan(ctx.prompt, EXAMPLE_HEADERS, toRange);
    if (marks.length < KEEP_EXAMPLES + 1) {
      const pairs = scan(ctx.prompt, EXAMPLE_PAIRS, toRange);
      if (pairs.length > marks.length) marks = pairs;
    }
    if (marks.length < KEEP_EXAMPLES + 1) return null;

    // Each example runs from its header to the start of the next one.
    const regions: Range[] = marks.map((mark, i) => ({
      start: mark.start,
      end: i + 1 < marks.length ? marks[i + 1]!.start : ctx.prompt.length,
    }));
    const sizes = regions.map((r) => ctx.count(ctx.prompt.slice(r.start, r.end)));
    const total = sizes.reduce((a, b) => a + b, 0);
    const excess = sizes.slice(KEEP_EXAMPLES).reduce((a, b) => a + b, 0);
    if (excess < 50) return null;

    const avg = Math.round(total / regions.length);
    return {
      ranges: regions.slice(KEEP_EXAMPLES),
      occurrences: marks.length,
      wastedTokens: excess,
      detail: `${marks.length} examples, about ${total.toLocaleString('en-US')} tokens (${avg.toLocaleString('en-US')} each). Keeping the first ${KEEP_EXAMPLES} would save roughly ${excess.toLocaleString('en-US')} tokens per request.`,
    };
  },
};

/* --------------------------------------------------- negative instructions */

export const negativePileup: Rule = {
  id: 'negative-instruction-pileup',
  title: 'A long list of things not to do',
  severity: 'medium',
  category: 'structure',
  autofix: false,
  summary: 'Prohibitions accumulate one incident at a time and are rarely removed.',
  why: [
    'Every production prompt grows a "never do this" section, one postmortem at a time. Nothing ever gets deleted from it, because deleting a prohibition feels like inviting the incident back.',
    'The token cost is the visible half. The other half is that a long list of negatives describes the space of wrong answers rather than the shape of the right one, and models follow a positive specification more reliably than a negative one.',
    'Convert where you can. Ten rules about what not to include in a summary usually collapse into one sentence describing what the summary should contain. That is shorter and works better.',
    'This is advisory: rewriting prohibitions correctly needs judgement about your task, so the optimizer will not attempt it.',
  ],
  example: {
    before: 'Do not use bullet points. Never exceed 200 words. Do not mention pricing. Never use jargon. Do not speculate...',
    after: 'Write one paragraph under 200 words in plain language, covering only what the ticket states.',
  },
  detect(ctx) {
    const hits = scan(
      ctx.prompt,
      /\b(?:do not|don'?t|never|must not|should not|avoid|refrain from|under no circumstances)\b/gi,
      (m) => ({ start: m.index, end: m.index + m[0].length, replacement: m[0]! }),
    );
    if (hits.length < 8) return null;
    return {
      ranges: hits.map((h) => ({ start: h.start, end: h.end })),
      occurrences: hits.length,
      detail: `${hits.length} prohibitions. Prompts this negative usually shrink by a third when rewritten as a positive specification.`,
    };
  },
};

/* ------------------------------------------------- output format described in prose */

export const formatProse: Rule = {
  id: 'output-format-prose',
  title: 'A JSON schema written out in English',
  severity: 'high',
  category: 'schema',
  autofix: false,
  summary: 'Describing your output shape in prose costs more than declaring it, and works less well.',
  why: [
    'Every major provider now supports constrained output: a JSON schema attached to the request, or a tool definition the model is forced to call. When you use one, the format is enforced by the decoder rather than requested politely in the prompt.',
    'Prompts written before that existed still carry two hundred tokens of "the response must be a JSON object with a key called summary whose value is a string of at most three sentences, and a key called priority whose value is one of low, medium or high". That paragraph is doing a job the schema field does better.',
    'You keep paying for it twice: once for the description, and again for the retry when the model emits prose around the JSON anyway. Constrained decoding removes the second cost entirely.',
    'Move the shape into the schema and leave only the semantics in the prompt — what "priority" means for your domain is worth explaining; what type it is, is not.',
  ],
  example: {
    before: 'Respond with valid JSON containing a "summary" key (string, max 3 sentences) and a "priority" key which must be exactly one of "low", "medium", or "high". Do not include markdown fences...',
    after: 'Set priority by customer impact, not by how upset the message sounds.\n(shape moved to a response schema)',
  },
  detect(ctx) {
    const mentionsJson = /\b(?:respond|reply|return|output|answer|format)\b[^.\n]{0,60}\bJSON\b/i.test(
      ctx.prompt,
    );
    if (!mentionsJson) return null;

    // Price the lines that describe field types rather than meaning.
    const typeTalk =
      /\b(?:key|field|property|attribute)\b[^.\n]{0,80}\b(?:string|number|integer|boolean|array|object|list|null)\b|\bmust be (?:a |an |one of )?["'a-z]/gi;
    const hits = scan(ctx.prompt, typeTalk, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      replacement: m[0]!,
    }));
    if (hits.length < 3) return null;

    // Estimate the size of the described-format region: the lines the hits sit on.
    const lineRanges = new Map<number, Range>();
    for (const hit of hits) {
      const lineStart = ctx.prompt.lastIndexOf('\n', hit.start) + 1;
      let lineEnd = ctx.prompt.indexOf('\n', hit.start);
      if (lineEnd === -1) lineEnd = ctx.prompt.length;
      lineRanges.set(lineStart, { start: lineStart, end: lineEnd });
    }
    const ranges = [...lineRanges.values()];
    const tokens = ranges.reduce((sum, r) => sum + ctx.count(ctx.prompt.slice(r.start, r.end)), 0);
    if (tokens < 40) return null;

    return {
      ranges,
      occurrences: ranges.length,
      wastedTokens: Math.round(tokens * 0.75),
      detail: `About ${tokens.toLocaleString('en-US')} tokens describe the output's shape. A response schema enforces that for free and cannot be ignored.`,
    };
  },
};

/* ------------------------------------------------------------- embedded blobs */

export const embeddedBlob: Rule = {
  id: 'embedded-blob',
  title: 'Encoded data pasted into the prompt',
  severity: 'high',
  category: 'structure',
  autofix: false,
  summary: 'Base64 and data URIs tokenize terribly — roughly one token per two or three characters.',
  why: [
    'Base64 has no word structure, so the tokenizer cannot find familiar chunks and falls back to short fragments. A rule of thumb is one token per two to three characters, against roughly one per four for English. A 100 kB base64 image in a prompt is tens of thousands of tokens.',
    'Almost every appearance of this is accidental: an image or file got serialised into a text field somewhere in a pipeline and nobody noticed, because the prompt still worked.',
    'If the payload is an image, send it as an image content block — providers price images by dimensions, not by encoded length, and it is usually an order of magnitude cheaper. If it is a file, send a reference and let a tool fetch it.',
  ],
  example: {
    before: 'Here is the logo: data:image/png;base64,iVBORw0KGgoAAAANSUhEUg... (14,000 tokens)',
    after: 'An image content block, or a URL the model can fetch with a tool.',
  },
  detect(ctx) {
    const hits = scan(ctx.prompt, /(?:data:[\w/+.-]+;base64,)?[A-Za-z0-9+/]{200,}={0,2}/g, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      replacement: m[0]!,
    }));
    if (!hits.length) return null;
    const tokens = hits.reduce((sum, h) => sum + ctx.count(ctx.prompt.slice(h.start, h.end)), 0);
    return {
      ranges: hits.map((h) => ({ start: h.start, end: h.end })),
      occurrences: hits.length,
      wastedTokens: tokens,
      detail: `${pluralize(hits.length, 'encoded blob')} totalling about ${tokens.toLocaleString('en-US')} tokens — more than half the cost of a typical prompt, for data the model probably cannot use in this form.`,
    };
  },
};

/* -------------------------------------------------------------- pretty JSON */

export const prettyJson: Rule = {
  id: 'pretty-printed-json',
  title: 'JSON indented for a human reader',
  severity: 'medium',
  category: 'schema',
  autofix: true,
  summary: 'Pretty-printing JSON in a prompt adds 20-30% tokens for whitespace nobody reads.',
  why: [
    'Indented JSON is easier for a person to scan, which is why it ends up in prompts: somebody copied it out of an API response viewer. The model parses minified JSON exactly as well.',
    'The overhead is whitespace, and whitespace is proportional to nesting depth times line count. On a deeply nested schema it is commonly a quarter of the block. On a large embedded config it can be a third.',
    'Minify it at the boundary rather than in the source, so the version in your repository stays readable and the version on the wire stays cheap. One `JSON.stringify(value)` without the indent argument is the whole fix.',
  ],
  example: {
    before: '{\n  "priority": {\n    "type": "string",\n    "enum": ["low", "high"]\n  }\n}',
    after: '{"priority":{"type":"string","enum":["low","high"]}}',
  },
  detect(ctx) {
    const edits: Edit[] = [];
    for (const span of findBalancedSpans(ctx.prompt)) {
      const text = ctx.prompt.slice(span.start, span.end);
      // Only worth rewriting when it is actually indented across lines.
      if (!text.includes('\n')) continue;
      if (!/\n[ \t]+["}\][{]/.test(text)) continue;
      let minified: string;
      try {
        minified = JSON.stringify(JSON.parse(text));
      } catch {
        continue;
      }
      if (minified.length >= text.length) continue;
      edits.push({ start: span.start, end: span.end, replacement: minified });
    }
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'JSON block')} indented for readability. Minifying is lossless.`,
    };
  },
};
