import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_RULES, CATEGORY_LABELS, type Category } from '@savedyouatoken/core';
import { Panel, SeverityTag } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Token waste patterns — what makes an LLM prompt expensive',
  description: `A reference of ${ALL_RULES.length} patterns that waste tokens in production prompts: what each one is, why it costs money, and what to do instead.`,
  alternates: { canonical: '/waste' },
};

const ORDER: Category[] = ['caching', 'structure', 'schema', 'model', 'formatting', 'filler'];

const CATEGORY_INTROS: Record<Category, string> = {
  caching:
    'Caching is a configuration change rather than a rewrite, and it routinely moves a bill by more than every text edit combined.',
  structure:
    'What the prompt is made of, and how much of it earns its place. These need judgement, so the optimizer reports them rather than applying them.',
  schema:
    'Tool definitions and output formats. Both are re-sent on every request, and both are commonly larger than the system prompt they accompany.',
  model:
    'Choices made outside the prompt that change what it costs: which model, which tokenizer, which price tier, and whether the bill is really about input at all.',
  formatting:
    'Whitespace, punctuation and emphasis. Individually trivial, collectively real, and always safe to fix automatically.',
  filler:
    'Words that do not change the output. Usually the easiest tokens to cut, and a sign the prompt has never been audited.',
};

export default function WasteIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Token waste patterns</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        The {ALL_RULES.length} patterns the analyser looks for, with the reasoning behind each one.
        Ordered by how much money they typically move, largest first.
      </p>
      <p className="mt-3 max-w-2xl text-[13px] text-faint">
        Every entry is checked automatically when you{' '}
        <Link href="/" className="text-info underline underline-offset-2">
          run a prompt through the analyser
        </Link>
        .
      </p>

      <div className="mt-10 space-y-10">
        {ORDER.map((category) => {
          const rules = ALL_RULES.filter((r) => r.category === category);
          if (!rules.length) return null;
          return (
            <section key={category}>
              <h2 className="text-[13px] uppercase tracking-wider text-faint">
                {CATEGORY_LABELS[category]}
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                {CATEGORY_INTROS[category]}
              </p>
              <ul className="mt-4 grid gap-2">
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <Link href={`/waste/${rule.id}`} className="block">
                      <Panel as="div" className="px-4 py-3 transition-colors hover:border-line-strong">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <SeverityTag severity={rule.severity} />
                          <h3 className="text-[15px] font-medium text-ink">{rule.title}</h3>
                          {rule.autofix ? (
                            <span className="text-[11px] text-save">auto-fixable</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{rule.summary}</p>
                      </Panel>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
