import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_RULES, FAMILY_FACTOR, MODELS, PRICES_VERIFIED_ON } from '@savedyouatoken/core';
import { Panel } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Methodology — how these numbers are produced',
  description:
    'Where the prices come from, which token counts are exact and which are estimated, how the caching maths is derived, and what this tool deliberately does not claim.',
  alternates: { canonical: '/methodology' },
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Methodology</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        This tool puts dollar figures next to your prompt. That is only useful if you can tell how
        much to trust each one, so here is exactly how every number is produced and where the soft
        spots are.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Token counts</h2>
        <div className="prose-doc mt-3 text-[14px]">
          <p>
            OpenAI publishes its tokenizer, so counts for GPT-4o and GPT-5 family models are{' '}
            <strong className="text-ink">exact</strong>. They are produced by running the real
            o200k_base byte-pair encoder in your browser.
          </p>
          <p>
            Anthropic and Google do not ship a public offline tokenizer. Counts for their models
            are <strong className="text-ink">estimates</strong>, derived from the o200k count and a
            family factor. Every place a number appears, the interface says which kind it is.
          </p>
          <p>
            The factors are deliberately conservative. Claude models up to Sonnet 4.6 and all Gemini
            models are treated as comparable to o200k for English text — an assumption, not a
            published figure. The one hard number is Anthropic&rsquo;s own documentation, which
            states that the tokenizer introduced with Claude Opus 4.7 produces approximately 30%
            more tokens for the same text than the previous Claude tokenizer.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto scroll-thin rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[28rem] text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2 text-left font-normal">
                  Family
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Factor
                </th>
                <th scope="col" className="px-4 py-2 text-left font-normal">
                  Basis
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-4 py-2 text-ink">o200k_base</td>
                <td className="num px-3 py-2 text-right text-ink">{FAMILY_FACTOR.o200k}</td>
                <td className="px-4 py-2 text-muted">Exact — the encoder is run directly.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-ink">Claude, Sonnet 4.6 and earlier</td>
                <td className="num px-3 py-2 text-right text-ink">
                  {FAMILY_FACTOR['claude-legacy']}
                </td>
                <td className="px-4 py-2 text-muted">Assumed comparable for English text.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-ink">Claude, Opus 4.7 and later</td>
                <td className="num px-3 py-2 text-right text-ink">{FAMILY_FACTOR['claude-next']}</td>
                <td className="px-4 py-2 text-muted">
                  Anthropic documents roughly 30% more tokens than the previous Claude tokenizer.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-ink">Gemini</td>
                <td className="num px-3 py-2 text-right text-ink">{FAMILY_FACTOR.gemini}</td>
                <td className="px-4 py-2 text-muted">Assumed comparable for English text.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-faint">
          Practically: treat estimated counts as accurate to within about 10% in absolute terms, and
          trust the relative comparisons more than the absolute figures.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Prices</h2>
        <div className="prose-doc mt-3 text-[14px]">
          <p>
            {MODELS.length} models, transcribed by hand from published pricing pages and dated in
            the source. Last verified <span className="num text-ink">{PRICES_VERIFIED_ON}</span>.
          </p>
          <p>
            They are not scraped at runtime. Scraping would add a server, a failure mode and a
            legal question in exchange for freshness measured in weeks, on data that changes
            monthly. A dated file that a person updates is the honest trade — and it means the whole
            application can be static.
          </p>
          <p>
            Figures are first-party API, default (global) routing, USD. Regional endpoints, data
            residency multipliers, enterprise discounts and marketplace billing are not modelled.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Cache economics</h2>
        <div className="prose-doc mt-3 text-[14px]">
          <p>
            A cache write costs <code>W</code> per token and each read costs <code>R</code>, against
            paying the base rate <code>B</code> every time. Over one write plus <code>k</code> reads,
            caching costs <code>W + kR</code> and not caching costs <code>(k+1)B</code>, so caching
            wins when <code>k &gt; (W − B) / (B − R)</code>.
          </p>
          <p>
            With a short-lived write at 1.25x the base rate and reads at a tenth, that gives{' '}
            <code>k &gt; 0.28</code> — one read. With an extended write at 2x it gives{' '}
            <code>k &gt; 1.11</code> — two reads. Those match the numbers Anthropic publishes, which
            is the check that the derivation is right; it is asserted in the test suite.
          </p>
          <p>
            The static prefix is taken as everything above the first per-request value in your
            prompt, because a cache prefix ends at the first byte that changes.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Savings figures</h2>
        <div className="prose-doc mt-3 text-[14px]">
          <p>
            The headline &ldquo;safe rewrite saves&rdquo; number is exact: the rewritten prompt is
            re-counted from scratch and the difference priced directly, rather than added up from
            separate estimates.
          </p>
          <p>
            The per-finding figures are attributions, and{' '}
            <strong className="text-ink">they can overlap</strong>. Caching examples and deleting
            examples both save the same tokens, so adding every finding together would overstate the
            total. That is why the interface reports the rewrite saving and the single largest
            structural opportunity as two separate numbers rather than one inflated one.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Limitations</h2>
        <div className="prose-doc mt-3 text-[14px]">
          <p>
            <strong className="text-ink">No step calls a model.</strong> Every one of the{' '}
            {ALL_RULES.length} checks is deterministic string and arithmetic work, which is why the
            tool is free, instant, and never sends your prompt anywhere.
          </p>
          <p>
            <strong className="text-ink">It doesn&rsquo;t judge quality.</strong> It can price what
            an example costs; whether removing it hurts your accuracy is a question for your evals.
            Deduplication is off by default for that reason, and the deeper structural findings are
            advisory rather than automatic.
          </p>
          <p>
            <strong className="text-ink">It has no visibility into your traffic.</strong> Every
            monthly figure comes from the request volume you enter, multiplied out — change that
            number and every dollar figure changes with it.
          </p>
        </div>
      </section>

      <Panel className="mt-10 px-4 py-4">
        <p className="text-[13px] leading-relaxed text-muted">
          Found a number that looks wrong? It is almost always a price that moved. The catalogue is
          one file in the repository, and a correction is a one-line change.
        </p>
        <Link href="/" className="mt-3 inline-block text-[13px] text-info underline underline-offset-2">
          Back to the analyser
        </Link>
      </Panel>
    </div>
  );
}
