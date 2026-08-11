import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ALL_RULES, CATEGORY_LABELS, getRule } from '@savedyouatoken/core';
import { Panel, SeverityTag } from '@/components/ui';
import { SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return ALL_RULES.map((rule) => ({ slug: rule.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const rule = getRule(slug);
  if (!rule) return { title: 'Not found' };
  return {
    title: `${rule.title} — LLM prompt token waste`,
    description: rule.summary,
    alternates: { canonical: `/waste/${rule.id}` },
    openGraph: { title: rule.title, description: rule.summary },
  };
}

export default async function WasteRulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rule = getRule(slug);
  if (!rule) notFound();

  const index = ALL_RULES.findIndex((r) => r.id === rule.id);
  const related = ALL_RULES.filter((r) => r.category === rule.category && r.id !== rule.id).slice(0, 4);
  const next = ALL_RULES[(index + 1) % ALL_RULES.length]!;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: rule.title,
    description: rule.summary,
    url: `${SITE_URL}/waste/${rule.id}`,
    articleSection: CATEGORY_LABELS[rule.category],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <Link href="/waste" className="hover:text-ink">
          Waste patterns
        </Link>
        <span className="mx-1.5 text-faint">/</span>
        <span className="text-faint">{CATEGORY_LABELS[rule.category]}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <SeverityTag severity={rule.severity} />
        {rule.autofix ? (
          <span className="rounded border border-save/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-save">
            auto-fixable
          </span>
        ) : (
          <span className="rounded border border-info/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-info">
            needs a human
          </span>
        )}
        {rule.aggressive ? (
          <span className="text-[11px] text-faint">only in aggressive mode</span>
        ) : null}
      </div>

      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink">
        {rule.title}
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink">{rule.summary}</p>

      <div className="prose-doc mt-8 text-[15px]">
        {rule.why.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {rule.example ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Panel as="div">
            <div className="border-b border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-danger">
              Before
            </div>
            <pre className="scroll-thin overflow-x-auto px-3 py-3 font-mono text-[12px] leading-relaxed text-muted">
              <code className="whitespace-pre-wrap">{rule.example.before}</code>
            </pre>
          </Panel>
          <Panel as="div">
            <div className="border-b border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-save">
              After
            </div>
            <pre className="scroll-thin overflow-x-auto px-3 py-3 font-mono text-[12px] leading-relaxed text-muted">
              <code className="whitespace-pre-wrap">{rule.example.after}</code>
            </pre>
          </Panel>
        </div>
      ) : null}

      <Panel className="mt-10 px-4 py-4">
        <h2 className="text-[15px] font-medium text-ink">Check your own prompt</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          The analyser checks this pattern along with the other {ALL_RULES.length - 1}, prices each
          finding against your request volume, and hands back a rewritten prompt. It runs in your
          browser — nothing is uploaded.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-save/50 bg-save/10 px-3 py-1.5 text-[13px] font-medium text-save hover:bg-save/20"
        >
          Run the analyser
        </Link>
      </Panel>

      {related.length ? (
        <section className="mt-10">
          <h2 className="text-[13px] uppercase tracking-wider text-faint">
            More on {CATEGORY_LABELS[rule.category].toLowerCase()}
          </h2>
          <ul className="mt-3 grid gap-1.5">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/waste/${r.id}`}
                  className="text-[14px] text-ink hover:underline underline-offset-2"
                >
                  {r.title}
                </Link>
                <span className="ml-2 text-[13px] text-faint">{r.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 border-t border-line pt-5 text-[13px]">
        <Link href={`/waste/${next.id}`} className="text-info hover:underline underline-offset-2">
          Next: {next.title} →
        </Link>
      </div>
    </div>
  );
}
