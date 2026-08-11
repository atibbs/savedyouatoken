import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze';
import { DEFAULT_WORKLOAD } from '../src/cost';
import { heuristicCounter } from '../src/tokens';
import { EXAMPLES } from '../src/examples';
import { decodeReport, encodeReport, toSharedReport } from '../src/report';
import { collapseDiff, diffFromEdits } from '../src/diff';
import { applyEdits } from '../src/analyze';

const example = EXAMPLES[0]!;
const result = analyze({
  prompt: example.prompt,
  modelId: example.modelId,
  workload: { ...DEFAULT_WORKLOAD, requestsPerDay: example.requestsPerDay },
  counter: heuristicCounter,
});

describe('share report', () => {
  it('round-trips through the URL encoding', async () => {
    const report = toSharedReport(result);
    const encoded = await encodeReport(report);
    const decoded = await decodeReport(encoded);
    expect(decoded).toEqual(report);
  });

  it('stays small enough for a URL fragment', async () => {
    const encoded = await encodeReport(toSharedReport(result));
    expect(encoded.length).toBeLessThan(4000);
  });

  it('never carries the prompt text', async () => {
    const encoded = await encodeReport(toSharedReport(result));
    const decoded = await decodeReport(encoded);
    const serialised = JSON.stringify(decoded);
    expect(serialised).not.toContain('{{ticket_body}}');
    expect(serialised).not.toContain('help centre');
  });

  it('returns null for corrupt input rather than throwing', async () => {
    expect(await decodeReport('zzzzznot-real')).toBeNull();
    expect(await decodeReport('')).toBeNull();
    expect(await decodeReport('q123')).toBeNull();
  });
});

describe('diff', () => {
  it('reconstructs the optimized text from the diff', () => {
    const segments = diffFromEdits(example.prompt, result.appliedEdits);
    const rebuilt = segments
      .filter((s) => s.type !== 'removed')
      .map((s) => s.text)
      .join('');
    expect(rebuilt).toBe(applyEdits(example.prompt, result.appliedEdits));
  });

  it('preserves the original when only equal segments are kept', () => {
    const segments = diffFromEdits(example.prompt, result.appliedEdits);
    const original = segments
      .filter((s) => s.type !== 'added')
      .map((s) => s.text)
      .join('');
    expect(original).toBe(example.prompt);
  });

  it('collapses long unchanged stretches', () => {
    const collapsed = collapseDiff(diffFromEdits(example.prompt, result.appliedEdits));
    expect(collapsed.some((s) => s.type === 'skip')).toBe(true);
  });
});
