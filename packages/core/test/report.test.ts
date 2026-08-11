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

  it('carries no prompt- or tool-derived text, even when findings mention them (canary)', async () => {
    // Unique strings planted in every input surface a finding's `detail` could echo.
    const CANARY = {
      prompt: 'CANARY_PROMPT_Z9',
      toolName: 'canary_tool_z9',
      toolDescription: 'CANARY_DESC_Z9',
      enumValue: 'CANARY_ENUM_Z9',
    };
    // A long description forces the schema rule to name the worst tool in its detail; a big
    // enum forces the oversized-enum branch — both historically leaked into the shared report.
    const tools = JSON.stringify([
      {
        type: 'function',
        function: {
          name: CANARY.toolName,
          description: `${CANARY.toolDescription} ${'a very long tool description '.repeat(12)}`,
          parameters: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            title: 'CanaryParams',
            type: 'object',
            additionalProperties: false,
            properties: {
              mode: {
                type: 'string',
                enum: [CANARY.enumValue, ...Array.from({ length: 120 }, (_, i) => `option_${i}`)],
              },
            },
          },
        },
      },
    ]);

    const canaryResult = analyze({
      prompt: `You are a helpful assistant. ${CANARY.prompt}`,
      toolsSource: tools,
      modelId: 'claude-opus-5',
      workload: { ...DEFAULT_WORKLOAD, requestsPerDay: 2000 },
      counter: heuristicCounter,
    });

    // Guard the test itself: confirm a finding's live `detail` really does echo the tool name,
    // so this test would fail if the report ever transmitted `detail` again.
    expect(canaryResult.findings.some((f) => f.detail.includes(CANARY.toolName))).toBe(true);

    const serialised = JSON.stringify(
      await decodeReport(await encodeReport(toSharedReport(canaryResult))),
    );
    for (const canary of Object.values(CANARY)) {
      expect(serialised).not.toContain(canary);
    }
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
