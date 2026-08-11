import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_RULES, MODELS, PRICES_VERIFIED_ON } from '@savedyouatoken/core';
import { Analyzer } from '@/components/analyzer/Analyzer';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'savedyouatoken — audit what your LLM prompt actually costs',
  description:
    'Paste a system prompt and get a priced list of what is wasting tokens, a lossless rewrite, a prompt-cache simulation and a cross-model cost comparison. Runs entirely in your browser.',
  alternates: { canonical: '/' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'savedyouatoken',
  url: SITE_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  description:
    'A deterministic audit of LLM prompt cost: token-waste findings priced in dollars per month, an automatic lossless rewrite, prompt-cache economics and cross-model comparison.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden border-b-[1.5px] border-line-strong">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#171713] bg-acid px-3 py-2 text-[#171713]">
            Free prompt audit
          </span>
          <h1 className="display mt-7 max-w-4xl text-[clamp(40px,7vw,88px)] text-ink">
            Your system prompt has a{' '}
            <span className="serif-accent">monthly bill.</span> Here is the itemisation.
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-[19px]">
            Paste a prompt. Get a ranked list of what is wasting tokens — each priced in dollars per
            month at your real request volume — plus a rewritten version you can copy, the caching
            maths for your workload, and what the same prompt would cost on every other model.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel px-3 py-2 font-mono text-[12px] text-ink">
            <span aria-hidden>🔒</span> No account. No upload. No model call — your prompt never
            leaves this browser.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Analyzer />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="grid gap-8 border-t border-line pt-10 md:grid-cols-3">
          <div>
            <h2 className="text-[15px] font-medium text-ink">What it looks for</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {ALL_RULES.length} patterns, from courtesy filler and smart quotes through to the
              expensive structural ones: static content stranded below a per-request value so it can
              never be cached, tool schemas nobody has priced, an output format written out in
              English that a response schema would enforce for free.
            </p>
            <Link
              href="/waste"
              className="mt-3 inline-block text-[13px] text-info underline underline-offset-2"
            >
              Browse all {ALL_RULES.length} patterns
            </Link>
          </div>

          <div>
            <h2 className="text-[15px] font-medium text-ink">Why the numbers differ per model</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              A token is a unit of a specific tokenizer, not of text. Claude models from Opus 4.7
              onward produce roughly 30% more tokens for identical text than earlier ones, so a
              model migration can raise your bill without a single prompt edit. The comparison
              re-counts per family instead of reusing one number.
            </p>
            <Link
              href="/waste/tokenizer-family-shift"
              className="mt-3 inline-block text-[13px] text-info underline underline-offset-2"
            >
              How tokenizer families change the bill
            </Link>
          </div>

          <div>
            <h2 className="text-[15px] font-medium text-ink">Where the prices come from</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {MODELS.length} models across Anthropic, OpenAI and Google, transcribed by hand from
              published pricing pages and dated. Last verified {PRICES_VERIFIED_ON}. Token counts are
              exact for OpenAI models and clearly labelled estimates elsewhere, because no public
              offline tokenizer exists for the others.
            </p>
            <Link
              href="/methodology"
              className="mt-3 inline-block text-[13px] text-info underline underline-offset-2"
            >
              Read the methodology
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
