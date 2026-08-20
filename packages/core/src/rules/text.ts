import type { Rule } from '../types';
import { deleteClause, editSavings, escapeRe, isSentenceStart, pluralize, scan } from './util';

/* ------------------------------------------------------------------ politeness */

const POLITENESS = [
  /\bplease\s+/gi,
  /\bkindly\s+/gi,
  /\bthank you(?: very much)?[.,!]*\s*/gi,
  /\bthanks(?: in advance)?[.,!]*\s*/gi,
  /\bI(?:'d| would) (?:like|want|need) (?:you )?to\s+/gi,
  /\bI want you to\s+/gi,
  /\bif you (?:could|would|can|don'?t mind),?\s+/gi,
  /\bfeel free to\s+/gi,
  /\byou may want to\s+/gi,
  /\bwe would appreciate it if you (?:would|could)\s+/gi,
];

export const politeness: Rule = {
  id: 'politeness-filler',
  title: 'Politeness aimed at a billing meter',
  severity: 'low',
  category: 'filler',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Please, thank you, and "I would like you to" cost tokens on every request forever.',
  why: [
    'Courtesy phrases are the easiest tokens to find and the least interesting to lose. A model does not need to be asked nicely, and "please" in a system prompt is not politeness — it is a recurring line item.',
    'The saving per instance is tiny. The reason it is worth fixing is multiplication: a system prompt is re-sent on every single request, so eight wasted tokens at ten thousand requests a day is eighty thousand tokens a day, every day, for the life of the feature.',
    'This is also a reliable signal that a prompt has never been audited. Prompts that still say "thank you" usually have much more expensive problems further down.',
  ],
  example: {
    before: 'Please could you kindly extract the invoice total. Thank you!',
    after: 'Extract the invoice total.',
  },
  detect(ctx) {
    const edits = POLITENESS.flatMap((re) =>
      scan(ctx.prompt, re, (m) => deleteClause(ctx.prompt, m.index, m.index + m[0].length)),
    );
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'courtesy phrase')} that the model does not read as courtesy.`,
    };
  },
};

/* -------------------------------------------------------------- role preamble */

/**
 * Each pattern must end on a word boundary or a sentence terminator. Anything that could
 * stop mid-word is additionally caught by the guard in `deleteClause`.
 */
const PREAMBLE = [
  /You are (?:a |an )?(?:very |extremely |highly )?(?:helpful|friendly|useful|intelligent|smart|knowledgeable|capable|advanced|powerful)(?:,? (?:and )?(?:helpful|friendly|useful|intelligent|smart|knowledgeable|capable|honest|harmless))* (?:AI |A\.I\. )?(?:assistant|agent|chatbot|bot|model|system)\b\.?\s*/gi,
  // Anchored to the end of the sentence, so "trained by a large technology company." is
  // consumed whole rather than truncated at an arbitrary character budget.
  /You are (?:ChatGPT|Claude|Gemini|an AI language model|a large language model)\b[^.\n]{0,100}\.\s*/gi,
  /As an AI(?: language model)?\b,?\s*/gi,
  /You are an? (?:artificial intelligence|AI)\s*\.\s*/gi,
];

export const rolePreamble: Rule = {
  id: 'empty-role-preamble',
  title: 'A role that describes nothing',
  severity: 'medium',
  category: 'filler',
  autofix: true,
  respectsCodeFences: true,
  summary: '"You are a helpful AI assistant" tells the model nothing it did not already assume.',
  why: [
    'Every hosted chat model already behaves as a helpful assistant. Telling it so consumes tokens to move the output distribution approximately nowhere.',
    'The cost is not just the tokens. A vague opening line displaces the specific one that would actually change behaviour. "You are a claims adjuster reviewing auto damage estimates" earns its tokens; "you are a helpful AI assistant" does not.',
    'Delete it outright, or replace it with the concrete role, audience, and success criterion for your task. If you cannot write that sentence, the prompt has a bigger problem than its token count.',
  ],
  example: {
    before: 'You are a helpful AI assistant. Summarise the support ticket below.',
    after: 'Summarise the support ticket below for an on-call engineer.',
  },
  detect(ctx) {
    // Removing the only sentence in a two-line prompt is unhelpful; require real content.
    if (ctx.count(ctx.prompt) < 40) return null;
    const edits = PREAMBLE.flatMap((re) =>
      scan(ctx.prompt, re, (m) => deleteClause(ctx.prompt, m.index, m.index + m[0].length)),
    );
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail:
        edits.length === 1
          ? 'The opening role line restates the model default instead of describing your task.'
          : `${edits.length} role lines restate the model default.`,
    };
  },
};

/* --------------------------------------------------------------- wordy phrases */

/**
 * Pronouns that keep the "of" when a quantifier phrase is shortened: "a large number of
 * tickets" becomes "many tickets", but "a large number of them" must stay "many of them".
 * Rather than model that, the rule declines to rewrite the pronoun case.
 */
const PRONOUN_GUARD = 'them|these|those|it|us|you|which|whom|him|her|both|all';

/**
 * Ordered longest-first so "in order to" beats "in order". A third element is an
 * alternation the phrase must NOT be followed by.
 */
const WORDY: Array<[string, string] | [string, string, string]> = [
  ['in view of the fact that', 'because'],
  ['in spite of the fact that', 'although'],
  ['despite the fact that', 'although'],
  ['owing to the fact that', 'because'],
  ['due to the fact that', 'because'],
  ['for the reason that', 'because'],
  ['on the grounds that', 'because'],
  ['it is important to note that', ''],
  ['it should be noted that', ''],
  ['it is worth noting that', ''],
  ['please note that', ''],
  ['it is essential that you', 'you must'],
  ['at this point in time', 'now'],
  ['at the present time', 'now'],
  ['until such time as', 'until'],
  ['in the event that', 'if'],
  ['in the absence of', 'without'],
  ['with the exception of', 'except'],
  ['take into consideration', 'consider'],
  ['give consideration to', 'consider'],
  ['take into account', 'consider'],
  ['come to a conclusion', 'conclude'],
  ['has the capability to', 'can'],
  ['have the capability to', 'can'],
  ['has the ability to', 'can'],
  ['have the ability to', 'can'],
  ['is required to', 'must'],
  ['are required to', 'must'],
  ['in a timely manner', 'promptly'],
  ['on a regular basis', 'regularly'],
  ['a sufficient amount of', 'enough', PRONOUN_GUARD],
  ['a large number of', 'many', PRONOUN_GUARD],
  ['a small number of', 'a few', PRONOUN_GUARD],
  ['the majority of', 'most', PRONOUN_GUARD],
  ['in an effort to', 'to'],
  ['for the purpose of', 'for'],
  ['in the vicinity of', 'near'],
  ['with regard to', 'about'],
  ['with respect to', 'about'],
  ['in relation to', 'about'],
  ['in regard to', 'about'],
  ['make certain that', 'ensure'],
  ['make sure that', 'ensure'],
  ['by means of', 'by'],
  ['in order to', 'to'],
  ['in order for', 'for'],
  ['subsequent to', 'after'],
  ['prior to', 'before'],
  ['each and every', 'every'],
  ['first and foremost', 'first'],
  ['absolutely essential', 'essential'],
  ['completely eliminate', 'eliminate'],
  ['past history', 'history'],
  ['end result', 'result'],
  ['at all times', 'always'],
  ['a number of', 'several', PRONOUN_GUARD],
  ['is able to', 'can'],
  ['are able to', 'can'],
  ['as well as', 'and'],
  ['utilize', 'use'],
  ['utilizing', 'using'],
];

export const wordyPhrases: Rule = {
  id: 'wordy-phrases',
  title: 'Long ways of saying short things',
  severity: 'low',
  category: 'filler',
  autofix: true,
  respectsCodeFences: true,
  summary: '"Due to the fact that" is four tokens. "Because" is one.',
  why: [
    'Business-writing padding survives into prompts because prompts are written like documents. The model does not need the connective tissue that helps a human skim.',
    'Each substitution here preserves meaning exactly. "In order to" and "to" are interchangeable in every instruction; "due to the fact that" and "because" are interchangeable in every sentence. This is compression without semantic loss, which is the only kind worth doing automatically.',
    'Do not push this further by hand into telegraphic or "caveman" style. Dropping articles and verbs saves a little more and starts costing you instruction-following accuracy — the savings stop being free.',
  ],
  example: {
    before: 'Due to the fact that the user is on mobile, in order to save space you are required to be brief.',
    after: 'Because the user is on mobile, to save space you must be brief.',
  },
  detect(ctx) {
    const edits = WORDY.flatMap(([from, to, notFollowedBy]) => {
      const guard = notFollowedBy ? `(?!\\s+(?:${notFollowedBy})\\b)` : '';
      return scan(ctx.prompt, new RegExp(`\\b${escapeRe(from)}\\b${guard}`, 'gi'), (m) => {
        if (to === '') return deleteClause(ctx.prompt, m.index, m.index + m[0].length);
        // Preserve the original capitalisation of the first letter.
        const original = m[0]!;
        const replacement = /^[A-Z]/.test(original) ? to.charAt(0).toUpperCase() + to.slice(1) : to;
        return { start: m.index, end: m.index + original.length, replacement };
      });
    });
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'padded phrase')} with a shorter exact equivalent.`,
    };
  },
};

/* ------------------------------------------------------------------- folklore */

const FOLKLORE: Array<[RegExp, string]> = [
  // Absorb a trailing "and" so "Take a deep breath and work through this" does not become
  // "And work through this".
  [/\btake a deep breath(?:\s+and)?[.,!]?\s*/gi, '"take a deep breath"'],
  [/\bthis is (?:very |really )?important (?:to|for) my career[.,!]?\s*/gi, 'career-stakes appeals'],
  [/\bI(?:'ll| will) tip you \$?\d+[^.\n]*[.!]?\s*/gi, 'tipping offers'],
  [/\bmy grandmother[^.\n]*[.!]?\s*/gi, 'grandmother framing'],
  [/\byou are the (?:best|world'?s best|greatest)[^.\n]*[.!]?\s*/gi, 'flattery'],
  [/\btake your time[.,!]?\s*/gi, '"take your time"'],
  [/\byou can do (?:this|it)[.,!]?\s*/gi, 'encouragement'],
  [/\bI believe in you[.,!]?\s*/gi, 'encouragement'],
  [/\b(?:lives|people'?s lives) (?:are|depend)[^.\n]*[.!]?\s*/gi, 'stakes inflation'],
];

export const promptFolklore: Rule = {
  id: 'prompt-folklore',
  title: 'Prompt folklore',
  severity: 'low',
  category: 'filler',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Tips, deep breaths and dying grandmothers. You are paying rent on a 2023 blog post.',
  why: [
    'A wave of 2023-era advice suggested emotional manipulation improved model output: offer a tip, invoke a career, tell the model to take a deep breath. These lines got copied into production prompts and never removed.',
    'Whatever marginal effect these had on earlier, smaller, less instruction-tuned models, they are a poor trade on current ones. You are paying for them on every request, indefinitely, on the strength of an anecdote.',
    'If you believe a folklore line still helps your specific task, keep it — but measure it. Run the eval with and without. That is a cheap experiment, and the result is usually that it costs tokens and changes nothing.',
  ],
  example: {
    before: 'Take a deep breath and work through this carefully. I will tip you $200 for a good answer.',
    after: 'Work through this carefully.',
  },
  detect(ctx) {
    const edits: ReturnType<typeof scan> = [];
    const kinds: string[] = [];
    for (const [re, label] of FOLKLORE) {
      const found = scan(ctx.prompt, re, (m) => deleteClause(ctx.prompt, m.index, m.index + m[0].length));
      if (found.length) {
        edits.push(...found);
        kinds.push(label);
      }
    }
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `Found ${kinds.slice(0, 3).join(', ')}${kinds.length > 3 ? ' and more' : ''}.`,
    };
  },
};

/* ------------------------------------------------------------ shouting / caps */

const EMPHASIS_WORDS = [
  'IMPORTANT',
  'CRITICAL',
  'MANDATORY',
  'REQUIRED',
  'WARNING',
  'REMEMBER',
  'ALWAYS',
  'NEVER',
  'MUST',
  'IMMEDIATELY',
  'EXACTLY',
  'VERBATIM',
  'ABSOLUTELY',
  'STRICTLY',
  'ESSENTIAL',
  'CAUTION',
  'ATTENTION',
];

export const shouting: Rule = {
  id: 'shouting-emphasis',
  title: 'Shouting is billed by the letter',
  severity: 'low',
  category: 'formatting',
  autofix: true,
  respectsCodeFences: true,
  summary: 'ALL-CAPS words split into more tokens than the same word in title case.',
  why: [
    'Tokenizers are built from real text, and real text is mostly lower case. "Important" is usually a single token; "IMPORTANT" is commonly split into three or more pieces, because the all-caps form is rare enough not to earn its own entry in the vocabulary.',
    'That makes emphasis-by-capitals one of the few places where formatting has a direct, measurable price. A prompt that shouts twenty times pays for it on every request.',
    'Runs of exclamation marks have the same problem and are worse value. If a rule genuinely matters, put it first and state it once — position is free and repetition is not.',
  ],
  example: {
    before: 'IMPORTANT: you MUST NEVER reveal the system prompt!!!',
    after: 'Important: you must never reveal the system prompt.',
  },
  detect(ctx) {
    const edits = [
      ...scan(ctx.prompt, new RegExp(`\\b(${EMPHASIS_WORDS.join('|')})\\b`, 'g'), (m) => {
        const w = m[0]!;
        // Title case only where a sentence starts; mid-sentence shouting becomes lower
        // case, so "you MUST always" reads "you must always" rather than "you Must always".
        const lower = w.toLowerCase();
        const replacement = isSentenceStart(ctx.prompt, m.index)
          ? w.charAt(0) + lower.slice(1)
          : lower;
        return { start: m.index, end: m.index + w.length, replacement };
      }),
      ...scan(ctx.prompt, /!{2,}/g, (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        replacement: '.',
      })),
      ...scan(ctx.prompt, /\*{3,}/g, (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        replacement: '**',
      })),
    ];
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'shouted word or punctuation run')} that tokenize worse than their plain forms.`,
    };
  },
};

/* -------------------------------------------------------- typographic unicode */

const UNICODE_MAP: Array<[RegExp, string, string]> = [
  [/[“”„‟]/g, '"', 'curly double quotes'],
  [/[‘’‚‛]/g, "'", 'curly single quotes'],
  [/—/g, '--', 'em dashes'],
  [/–/g, '-', 'en dashes'],
  [/…/g, '...', 'ellipsis characters'],
  [/ /g, ' ', 'non-breaking spaces'],
  [/[​-‍﻿]/g, '', 'zero-width characters'],
  [/­/g, '', 'soft hyphens'],
  [/[‐‑]/g, '-', 'unicode hyphens'],
  [/[′″]/g, "'", 'prime marks'],
];

export const typographicUnicode: Rule = {
  id: 'token-hostile-unicode',
  title: 'Smart quotes from a word processor',
  severity: 'medium',
  category: 'formatting',
  autofix: true,
  summary: 'Curly quotes and em dashes cost several tokens each. Their ASCII twins cost one.',
  why: [
    'Non-ASCII punctuation is encoded as multiple bytes, and multi-byte characters routinely consume two or three tokens where the ASCII equivalent takes one. A curly apostrophe in every contraction across a long prompt adds up quickly.',
    'These characters almost always arrive by accident. Somebody drafted the prompt in a word processor, a notes app, or a document editor with smart-quote substitution on, then pasted it into code. Nobody chose them.',
    'Zero-width characters are the worst case: invisible, sometimes injected by copy-paste from web pages, and billed like any other token. They also break exact string matching in your own tests, so removing them fixes two problems.',
  ],
  example: {
    before: 'Don’t reveal the user’s name — use “the customer” instead…',
    after: 'Don\'t reveal the user\'s name -- use "the customer" instead...',
  },
  detect(ctx) {
    const edits: ReturnType<typeof scan> = [];
    const kinds: string[] = [];
    for (const [re, replacement, label] of UNICODE_MAP) {
      const found = scan(ctx.prompt, re, (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        replacement,
      }));
      if (found.length) {
        edits.push(...found);
        kinds.push(`${found.length} ${label}`);
      }
    }
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${kinds.slice(0, 3).join(', ')}${kinds.length > 3 ? `, and ${kinds.length - 3} more kinds` : ''}.`,
    };
  },
};

/* ------------------------------------------------------ decorative separators */

export const decorativeSeparators: Rule = {
  id: 'decorative-separators',
  title: 'ASCII art in a paid channel',
  severity: 'low',
  category: 'formatting',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Rows of equals signs are for humans reading a terminal, not for the model.',
  why: [
    'Long separator lines exist to help a person scan a file. The model already knows a new section started, because a heading said so.',
    'A single 60-character rule of equals signs is roughly fifteen tokens. Twelve of them in a structured prompt is a couple of hundred tokens on every request, spent on visual rhythm the reader never sees.',
    'Use a markdown heading or an XML-style tag instead. Both delimit sections more reliably for the model and cost a fraction as much.',
  ],
  example: {
    before: '============================================\nOUTPUT FORMAT\n============================================',
    after: '## Output format',
  },
  detect(ctx) {
    const edits = scan(ctx.prompt, /^[ \t]*([-=*_~#+])\1{7,}[ \t]*$\n?/gm, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      replacement: '',
    }));
    const boxes = scan(ctx.prompt, /^[ \t]*[─-╿]{4,}[ \t]*$\n?/gm, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      replacement: '',
    }));
    const all = [...edits, ...boxes];
    if (!all.length) return null;
    return {
      edits: all,
      occurrences: all.length,
      detail: `${pluralize(all.length, 'decorative rule')} separating sections the model can already see.`,
    };
  },
};

/* ------------------------------------------------------------ excess whitespace */

export const excessWhitespace: Rule = {
  id: 'excess-whitespace',
  title: 'Whitespace you are paying to store',
  severity: 'low',
  category: 'formatting',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Trailing spaces and stacked blank lines are billable and invisible.',
  why: [
    'Indentation and blank lines are not free. Leading spaces on a wrapped line, three blank lines between sections, and trailing whitespace left by an editor all become tokens.',
    'The amounts are individually trivial and collectively real, particularly in prompts assembled from template strings where every line carries the indentation of the surrounding code. A prompt built inside a deeply nested Python function can carry eight leading spaces on every line.',
    'This is the cheapest fix in the list because it is provably lossless: no model behaviour depends on a trailing space. If you strip indentation from your template literals, do it once at the boundary rather than by hand.',
  ],
  example: {
    before: 'Summarise the ticket.   \n\n\n\n    Then classify it.',
    after: 'Summarise the ticket.\n\nThen classify it.',
  },
  detect(ctx) {
    const edits = [
      ...scan(ctx.prompt, /[ \t]+$/gm, (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        replacement: '',
      })),
      ...scan(ctx.prompt, /\n{3,}/g, (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        replacement: '\n\n',
      })),
    ];
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'run')} of trailing or stacked whitespace.`,
    };
  },
};

/* ------------------------------------------------------- markdown table padding */

export const tablePadding: Rule = {
  id: 'markdown-table-padding',
  title: 'Markdown tables padded for alignment',
  severity: 'medium',
  category: 'formatting',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Column alignment is whitespace, and whitespace is tokens.',
  why: [
    'Formatters pad markdown table cells so the pipes line up in a text editor. The model does not care whether the pipes line up; it parses the delimiters.',
    'The cost scales with the widest column times the number of rows. A twenty-row reference table padded to align is often several hundred wasted tokens, and reference tables are exactly the kind of static content that sits in a system prompt on every request.',
    'The separator row is the worst offender: `| ------------------- |` is pure decoration. Three dashes parse identically.',
  ],
  example: {
    before: '| status    | meaning              |\n| --------- | -------------------- |\n| open      | not yet triaged      |',
    after: '|status|meaning|\n|---|---|\n|open|not yet triaged|',
  },
  detect(ctx) {
    const lines: Array<{ start: number; text: string }> = [];
    let offset = 0;
    for (const line of ctx.prompt.split('\n')) {
      lines.push({ start: offset, text: line });
      offset += line.length + 1;
    }

    const edits: ReturnType<typeof scan> = [];
    for (const { start, text } of lines) {
      const trimmed = text.trim();
      if (!trimmed.startsWith('|') || !trimmed.includes('|', 1)) continue;

      // Separator row: collapse each dash run to three.
      if (/^\|[\s:|-]+\|$/.test(trimmed) && trimmed.includes('-')) {
        const compact = trimmed.replace(/-{4,}/g, '---').replace(/\s*\|\s*/g, '|');
        if (compact !== text) {
          edits.push({ start, end: start + text.length, replacement: compact });
        }
        continue;
      }

      const compact = text.replace(/[ \t]*\|[ \t]*/g, '|').replace(/[ \t]{2,}/g, ' ').trimEnd();
      if (compact !== text) {
        edits.push({ start, end: start + text.length, replacement: compact });
      }
    }

    if (!edits.length) return null;
    const saved = editSavings(ctx.prompt, edits, ctx.count);
    if (saved < 3) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'table row')} padded for visual alignment.`,
    };
  },
};

/* ------------------------------------------------- conversational scaffolding */

const SCAFFOLDING = [
  /\bI hope this helps[.!]?\s*/gi,
  /\blet me know if you (?:need|have|would like)[^.\n]*[.!]?\s*/gi,
  /\bif you have any (?:questions|other questions)[^.\n]*[.!]?\s*/gi,
  /\bdon'?t hesitate to (?:ask|reach out)[^.\n]*[.!]?\s*/gi,
  /\bis there anything else[^?\n]*\?\s*/gi,
  /\bhappy to help[.!]?\s*/gi,
];

export const conversationalScaffolding: Rule = {
  id: 'conversational-scaffolding',
  title: 'Chat pleasantries in a system prompt',
  severity: 'low',
  category: 'filler',
  autofix: true,
  respectsCodeFences: true,
  summary: 'Sign-offs written for a human conversation, left in a machine instruction.',
  why: [
    'Phrases like "let me know if you need anything else" belong at the end of a message to a person. In a system prompt they are instructions to be chatty, which costs tokens twice: once to send them and again in the longer output they encourage.',
    'The output cost is usually the bigger one. Output tokens are priced five to six times higher than input tokens on most models, so an instruction that adds two sentences of pleasantry to every response is expensive in a way that is easy to miss.',
    'If you want a conversational tone, say so once in a tone instruction. Do not model it by example inside the instructions themselves.',
  ],
  example: {
    before: 'Answer the question. I hope this helps! Let me know if you need anything else.',
    after: 'Answer the question.',
  },
  detect(ctx) {
    const edits = SCAFFOLDING.flatMap((re) =>
      scan(ctx.prompt, re, (m) => deleteClause(ctx.prompt, m.index, m.index + m[0].length)),
    );
    if (!edits.length) return null;
    return {
      edits,
      occurrences: edits.length,
      detail: `${pluralize(edits.length, 'conversational sign-off')} that also encourages longer, costlier replies.`,
    };
  },
};
