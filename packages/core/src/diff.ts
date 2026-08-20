import type { Edit } from './types';

export type DiffSegment = { type: 'equal' | 'removed' | 'added'; text: string };

/**
 * Build a diff directly from the edit list rather than running a generic diff algorithm.
 *
 * We already know exactly which spans changed, so this is both exact and linear — a real
 * diff would be quadratic in prompt length for no extra information.
 */
export function diffFromEdits(original: string, edits: Edit[]): DiffSegment[] {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  const out: DiffSegment[] = [];
  let cursor = 0;

  const push = (type: DiffSegment['type'], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };

  for (const e of sorted) {
    if (e.start < cursor) continue;
    push('equal', original.slice(cursor, e.start));
    push('removed', original.slice(e.start, e.end));
    push('added', e.replacement);
    cursor = e.end;
  }
  push('equal', original.slice(cursor));
  return out;
}

/**
 * Collapse long unchanged stretches so a diff of a 5,000-token prompt is readable.
 * Keeps `context` characters either side of each change.
 */
export function collapseDiff(
  segments: DiffSegment[],
  context = 160,
): Array<DiffSegment | { type: 'skip'; text: string; chars: number }> {
  const out: Array<DiffSegment | { type: 'skip'; text: string; chars: number }> = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.type !== 'equal') {
      out.push(seg);
      continue;
    }
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    const head = isFirst ? '' : seg.text.slice(0, context);
    const tail = isLast ? '' : seg.text.slice(-context);
    const hiddenChars = seg.text.length - head.length - tail.length;

    if (hiddenChars <= 80) {
      out.push(seg);
      continue;
    }
    if (head) out.push({ type: 'equal', text: head });
    const lines = seg.text.slice(head.length, seg.text.length - tail.length).split('\n').length;
    out.push({
      type: 'skip',
      text: `${hiddenChars.toLocaleString('en-US')} unchanged characters (${lines} lines)`,
      chars: hiddenChars,
    });
    if (tail) out.push({ type: 'equal', text: tail });
  }

  return out;
}
