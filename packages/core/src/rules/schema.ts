import type { Rule } from '../types';
import { DAYS_PER_MONTH, formatUsd, ratesFor } from '../cost';
import { pluralize } from './util';

/** Keys that carry no signal for the model but ship on every request. */
const NOISE_KEYS = ['$schema', 'title', 'default', 'examples', 'additionalProperties', '$id'];

function monthlyCostOfTokens(
  tokens: number,
  ctx: Parameters<Rule['detect']>[0],
): number {
  const rates = ratesFor(ctx.model, tokens, ctx.workload);
  return (tokens * rates.input * ctx.workload.requestsPerDay * DAYS_PER_MONTH) / 1_000_000;
}

export const toolDefinitionOverhead: Rule = {
  id: 'tool-definition-overhead',
  title: 'What your tools cost before anyone calls one',
  severity: 'high',
  category: 'schema',
  autofix: false,
  summary: 'Tool schemas are re-sent on every request, plus a provider system prompt you never see.',
  why: [
    'Tool definitions are input tokens. Every name, description, parameter and enum value in your `tools` array is serialised into the request on every call, whether or not the model uses any of them.',
    'On top of that, providers inject their own tool-use instructions. Anthropic publishes the figures: between roughly 286 and 804 tokens depending on model and tool-choice setting, before a single byte of your own schemas. That overhead is invisible in your code and appears only on your invoice.',
    'Teams are routinely surprised to find their tool block is larger than their system prompt. Twenty tools with paragraph-length descriptions is a few thousand tokens on every request, forever.',
    'Two fixes, in order of leverage. First, cache the tool block — it is perfectly static, which makes it ideal cache content. Second, stop sending tools the current step cannot use: load them per phase, or expose a small set and let the model request more.',
  ],
  example: {
    before: '18 tools, 3,900 tokens, attached to every request including the ones that just answer a question.',
    after: 'A 4-tool set for this step, behind a cache breakpoint.',
  },
  detect(ctx) {
    if (!ctx.tools.length) return null;

    const minified = JSON.stringify(ctx.tools.map((t) => JSON.parse(t.raw)));
    const schemaTokens = ctx.count(minified);
    const providerOverhead = ctx.model.toolSystemPromptTokens?.auto ?? 0;
    const total = schemaTokens + providerOverhead;

    const share = ctx.inputTokens > 0 ? (total / ctx.inputTokens) * 100 : 0;

    // Minifying what the user pasted, if it was pretty-printed.
    const pastedTokens = ctx.count(ctx.toolsSource.trim());
    const minifySaving = Math.max(0, pastedTokens - schemaTokens);

    const monthly = monthlyCostOfTokens(total, ctx);
    const overheadNote = providerOverhead
      ? ` plus ${providerOverhead.toLocaleString('en-US')} tokens of provider tool-use instructions that ${ctx.model.name} adds automatically`
      : '';
    const minifyNote = minifySaving > 20 ? ` Minifying the schemas alone would save ${minifySaving.toLocaleString('en-US')} tokens.` : '';

    return {
      occurrences: ctx.tools.length,
      wastedTokens: total,
      monthlySaving: 0, // Tools are not waste by default; this is a cost disclosure.
      detail: `${pluralize(ctx.tools.length, 'tool')} cost ${schemaTokens.toLocaleString('en-US')} tokens${overheadNote} — ${Math.round(share)}% of this request, about ${formatUsd(monthly)} a month.${minifyNote}`,
    };
  },
};

export const bloatedToolSchemas: Rule = {
  id: 'bloated-tool-schemas',
  title: 'Tool schemas carrying dead weight',
  severity: 'medium',
  category: 'schema',
  autofix: false,
  summary: 'Long descriptions, JSON Schema boilerplate, and enums with a hundred values.',
  why: [
    'A tool description should tell the model when to reach for the tool. It does not need usage examples, changelog notes, or a restatement of what each parameter type is — the schema already declares the types.',
    'JSON Schema metadata is the common offender. `$schema`, `$id`, `title` and `default` are for validators and documentation generators. The model gains nothing from them and you pay for them on every request.',
    'Enums deserve their own attention. A `country` parameter with all 249 ISO codes inline is over a thousand tokens on every call. Accept a free string and validate on your side, or narrow the list to what your product actually supports.',
    'A good target is one or two sentences per tool and one clause per parameter. If a tool needs three paragraphs to explain, it is usually two tools.',
  ],
  example: {
    before: '"description": "Use this tool to search. Example: search({query: \'x\'}). Note: added in v2.1. The query parameter is a string..."',
    after: '"description": "Search the product catalogue. Prefer this over answering from memory."',
  },
  detect(ctx) {
    if (!ctx.tools.length) return null;

    const longDescriptions = ctx.tools
      .map((t) => ({ name: t.name, tokens: t.description ? ctx.count(t.description) : 0 }))
      .filter((t) => t.tokens > 60)
      .sort((a, b) => b.tokens - a.tokens);

    const noiseFound = NOISE_KEYS.filter((k) => ctx.toolsSource.includes(`"${k}"`));

    const bigEnums: number[] = [];
    const enumRe = /"enum"\s*:\s*\[([^\]]{200,})\]/g;
    let m: RegExpExecArray | null;
    while ((m = enumRe.exec(ctx.toolsSource)) !== null) {
      bigEnums.push(ctx.count(m[1]!));
    }

    if (!longDescriptions.length && !noiseFound.length && !bigEnums.length) return null;

    const wasted =
      longDescriptions.reduce((sum, t) => sum + Math.max(0, t.tokens - 40), 0) +
      bigEnums.reduce((sum, t) => sum + Math.round(t * 0.6), 0) +
      noiseFound.length * 6;

    const parts: string[] = [];
    if (longDescriptions.length) {
      const worst = longDescriptions[0]!;
      parts.push(
        `${pluralize(longDescriptions.length, 'tool')} with descriptions over 60 tokens (worst: \`${worst.name}\` at ${worst.tokens})`,
      );
    }
    if (bigEnums.length) {
      parts.push(`${pluralize(bigEnums.length, 'oversized enum')} totalling ${bigEnums.reduce((a, b) => a + b, 0).toLocaleString('en-US')} tokens`);
    }
    if (noiseFound.length) {
      parts.push(`schema metadata the model ignores (${noiseFound.map((k) => `\`${k}\``).join(', ')})`);
    }

    return {
      occurrences: longDescriptions.length + bigEnums.length + noiseFound.length,
      wastedTokens: wasted,
      monthlySaving: monthlyCostOfTokens(wasted, ctx),
      detail: `${parts.join('; ')}.`,
    };
  },
};
