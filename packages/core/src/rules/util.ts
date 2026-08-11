import type { Edit } from '../types';

/** Run a global regex and build edits from a callback. Returns [] when nothing matched. */
export function scan(
  text: string,
  re: RegExp,
  build: (m: RegExpExecArray) => Edit | null,
): Edit[] {
  const edits: Edit[] = [];
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    const edit = build(m);
    if (edit && edit.end > edit.start) edits.push(edit);
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
  return edits;
}

/**
 * Delete a phrase that opens a sentence, promoting the following word to a capital so the
 * rewrite still reads as English. Returns an edit spanning the phrase plus the next letter.
 *
 * Returns null when the match ends inside a word. A bounded pattern can stop mid-word —
 * matching "...trained by a large technology co" out of "company" — and deleting that range
 * would leave a mangled fragment in the user's prompt. Refusing is always the safe answer:
 * the worst case is a missed saving rather than a corrupted rewrite.
 */
export function deleteClause(text: string, start: number, end: number): Edit | null {
  const isWordChar = (ch: string | undefined) => ch != null && /[A-Za-z0-9]/.test(ch);
  if (isWordChar(text[end - 1]) && isWordChar(text[end])) return null;

  // Absorb a following space so we don't leave a double space behind.
  let e = end;
  while (e < text.length && text[e] === ' ') e++;

  const atSentenceStart = isSentenceStart(text, start);
  const next = text[e];
  if (atSentenceStart && next && /[a-z]/.test(next)) {
    return { start, end: e + 1, replacement: next.toUpperCase() };
  }
  return { start, end: e, replacement: '' };
}

export function isSentenceStart(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i]!;
    if (ch === ' ' || ch === '\t') continue;
    return ch === '\n' || ch === '.' || ch === '!' || ch === '?' || ch === ':' || ch === '-' || ch === '>';
  }
  return true;
}

/** Sum the token cost removed by a set of edits, using the supplied counter. */
export function editSavings(text: string, edits: Edit[], count: (s: string) => number): number {
  let saved = 0;
  for (const e of edits) {
    saved += count(text.slice(e.start, e.end)) - count(e.replacement);
  }
  return Math.max(0, saved);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** Escape a literal string for use inside a RegExp. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
