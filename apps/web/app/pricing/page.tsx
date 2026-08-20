import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_RULES } from '@savedyouatoken/core';
import { Panel } from '@/components/ui';
import { FREE_SAVED_LIMIT } from '@/lib/limits';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'The analyser is free and always will be. Pro adds prompt history, regression alerts and a token budget you can enforce in CI.',
  alternates: { canonical: '/pricing' },
};

const FREE = [
  'The full analyser — all ' + ALL_RULES.length + ' waste patterns, no feature gates',
  'Automatic lossless rewrite, with the diff',
  'Prompt-cache simulation',
  'Cost comparison across every model',
  'Shareable report links',
  `${FREE_SAVED_LIMIT} saved prompts in your browser`,
  'The CLI, for local and offline analysis',
];

const PRO = [
  'Unlimited saved prompts, with version history',
  'Diff any two versions and see what the change cost you',
  'Regression alerts when a prompt grows past its budget',
  'CI token budgets: a GitHub Action that fails the pull request',
  'Batch analysis across a whole prompts directory',
  'Team workspaces and shared reports',
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Pricing</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        The audit is free — it runs in your browser, so there&rsquo;s nothing for us to pay for.
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        What&rsquo;s worth paying for isn&rsquo;t the one-time audit. It&rsquo;s keeping the prompt
        from growing back.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-lg font-medium text-ink">Free</h2>
          <p className="num mt-1 text-3xl font-semibold text-ink">$0</p>
          <p className="mt-1 text-[13px] text-muted">No account. Nothing to cancel.</p>
          <ul className="mt-5 space-y-2 text-[13px] text-muted">
            {FREE.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-save">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded border border-save/50 bg-save/10 px-3 py-2 text-[13px] font-medium text-save hover:bg-save/20"
          >
            Open the analyser
          </Link>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-medium text-ink">Pro</h2>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
              not live yet
            </span>
          </div>
          <p className="num mt-1 text-3xl font-semibold text-ink">
            $19<span className="text-base font-normal text-muted">/month</span>
          </p>
          <p className="mt-1 text-[13px] text-muted">Per developer. Team plan at $79 for five.</p>
          <ul className="mt-5 space-y-2 text-[13px] text-muted">
            {PRO.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-faint">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button type="button" disabled className="mt-6 w-full cursor-not-allowed border border-line-strong bg-raised px-3 py-2 text-[13px] text-faint">
            Not yet available
          </button>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            Pro is fully specced but deliberately not built yet — see &ldquo;Why this split&rdquo;
            below.
          </p>
        </Panel>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-medium text-ink">Why this split</h2>
        <div className="prose-doc mt-3 max-w-2xl text-[14px]">
          <p>
            A one-time audit is a handy utility, not a product. The recurring problem is that prompts
            grow back — every fix adds a line, and nobody deletes.
          </p>
          <p>
            Pro is the part that keeps that in check: a budget your prompt can&rsquo;t quietly exceed,
            checked in the pull request where the growth happens. The free tool shows the problem
            once; Pro stops it coming back. Every insight stays free either way.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Free today, in the CLI</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Budgets already work for free in the CLI. Pro adds the hosted parts: history, alerts, and a
          comment on your pull request.
        </p>
        <Link href="/cli" className="mt-3 inline-block text-[13px] text-info underline underline-offset-2">
          Set up a token budget in CI
        </Link>
      </section>
    </div>
  );
}
