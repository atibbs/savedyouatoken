import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DEFAULT_WORKLOAD,
  FAMILY_LABELS,
  MODELS,
  PRICES_VERIFIED_ON,
  PROVIDER_LABELS,
  costOf,
  formatRate,
  formatUsd,
  getModel,
  simulateCache,
} from '@savedyouatoken/core';
import { Panel } from '@/components/ui';
import { SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return MODELS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const model = getModel(id);
  if (!model) return { title: 'Not found' };
  return {
    title: `${model.name} API pricing and cost per request`,
    description: `${model.name} costs ${formatRate(model.pricing.input)} per million input tokens and ${formatRate(model.pricing.output)} per million output tokens. Worked monthly costs, prompt-cache economics and cheaper alternatives.`,
    alternates: { canonical: `/models/${model.id}` },
  };
}

const PROMPT_SIZES = [1_000, 5_000, 20_000];
const VOLUMES = [1_000, 10_000, 100_000];

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = getModel(id);
  if (!model) notFound();

  const workload = { ...DEFAULT_WORKLOAD, outputTokens: 500 };
  const cheaper = MODELS.filter(
    (m) => m.id !== model.id && !m.legacy && m.pricing.input < model.pricing.input,
  )
    .sort((a, b) => b.pricing.input - a.pricing.input)
    .slice(0, 5);

  const cacheDemo = simulateCache(model, 10_000, 500, {
    ...workload,
    requestsPerDay: 10_000,
    cacheHitRate: 0.8,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${model.name} API`,
    description: `${model.name} language model API pricing.`,
    url: `${SITE_URL}/models/${model.id}`,
    brand: { '@type': 'Brand', name: PROVIDER_LABELS[model.provider] },
    offers: {
      '@type': 'Offer',
      price: model.pricing.input,
      priceCurrency: 'USD',
      description: 'USD per million input tokens',
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <Link href="/models" className="hover:text-ink">
          Model prices
        </Link>
        <span className="mx-1.5 text-faint">/</span>
        <span className="text-faint">{PROVIDER_LABELS[model.provider]}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{model.name}</h1>
      <p className="mt-2 text-[15px] text-muted">
        <span className="num text-ink">{formatRate(model.pricing.input)}</span> per million input
        tokens, <span className="num text-ink">{formatRate(model.pricing.output)}</span> per million
        output.
        {model.legacy ? ' Superseded — kept here so you can price existing code.' : ''}
      </p>
      {model.note ? <p className="mt-2 text-[13px] text-warn">{model.note}</p> : null}

      <Panel className="mt-6">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-line">
            <Row label="Input" value={`${formatRate(model.pricing.input)} / MTok`} />
            <Row label="Output" value={`${formatRate(model.pricing.output)} / MTok`} />
            <Row
              label="Cache read"
              value={
                model.pricing.cacheRead != null
                  ? `${formatRate(model.pricing.cacheRead)} / MTok`
                  : 'no prompt caching'
              }
            />
            <Row
              label="Cache write (5 min)"
              value={
                model.pricing.cacheWrite5m != null
                  ? `${formatRate(model.pricing.cacheWrite5m)} / MTok`
                  : model.pricing.cacheRead != null
                    ? 'billed at the base input rate'
                    : '—'
              }
            />
            {model.pricing.cacheWrite1h != null ? (
              <Row label="Cache write (1 hour)" value={`${formatRate(model.pricing.cacheWrite1h)} / MTok`} />
            ) : null}
            {model.pricing.batchInput != null ? (
              <Row
                label="Batch API"
                value={`${formatRate(model.pricing.batchInput)} in / ${formatRate(model.pricing.batchOutput)} out`}
              />
            ) : null}
            {model.pricing.longContext ? (
              <Row
                label={`Above ${model.pricing.longContext.aboveInputTokens.toLocaleString('en-US')} tokens`}
                value={`${formatRate(model.pricing.longContext.input)} in / ${formatRate(model.pricing.longContext.output)} out`}
              />
            ) : null}
            <Row
              label="Context window"
              value={model.contextWindow ? `${model.contextWindow.toLocaleString('en-US')} tokens` : 'not published here'}
            />
            <Row label="Tokenizer family" value={FAMILY_LABELS[model.family]} />
            {model.toolSystemPromptTokens ? (
              <Row
                label="Tool-use overhead"
                value={`${model.toolSystemPromptTokens.auto} tokens added when any tool is defined`}
              />
            ) : null}
          </tbody>
        </table>
      </Panel>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">What that costs per month</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Monthly spend for a prompt of a given size, with a 500-token response, no caching. Rows
          are prompt size; columns are requests per day.
        </p>
        <div className="mt-3 overflow-x-auto scroll-thin rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[30rem] text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2 text-left font-normal">
                  Prompt size
                </th>
                {VOLUMES.map((v) => (
                  <th key={v} scope="col" className="px-3 py-2 text-right font-normal">
                    {v.toLocaleString('en-US')} / day
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PROMPT_SIZES.map((size) => (
                <tr key={size}>
                  <th scope="row" className="num px-4 py-2 text-left font-normal text-muted">
                    {size.toLocaleString('en-US')} tokens
                  </th>
                  {VOLUMES.map((v) => (
                    <td key={v} className="num px-3 py-2 text-right text-ink">
                      {formatUsd(costOf(model, 0, size, { ...workload, requestsPerDay: v }).perMonth)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {cacheDemo.supported ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">Prompt caching on {model.name}</h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
            A 10,000-token static prefix at 10,000 requests a day costs{' '}
            <span className="num text-ink">{formatUsd(cacheDemo.monthlyWithoutCache)}</span> a month
            uncached. With caching at an 80% hit rate it costs{' '}
            <span className="num text-ink">{formatUsd(cacheDemo.monthlyWithCache)}</span> — a saving
            of <span className="num text-save">{formatUsd(cacheDemo.monthlySaving)}</span>, or{' '}
            {Math.round(cacheDemo.savingPercent)}%. Caching pays for itself after{' '}
            {cacheDemo.breakevenReads} read{cacheDemo.breakevenReads === 1 ? '' : 's'} of the same
            prefix.
          </p>
          <Link
            href="/waste/no-prompt-caching"
            className="mt-2 inline-block text-[13px] text-info underline underline-offset-2"
          >
            How cache economics work
          </Link>
        </section>
      ) : null}

      {cheaper.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">Cheaper on input</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            Lower input price. Whether they are cheaper for <em>your</em> task depends on token
            counts and on whether they hold up on your evals.
          </p>
          <ul className="mt-3 grid gap-1.5 text-[14px]">
            {cheaper.map((m) => (
              <li key={m.id}>
                <Link href={`/models/${m.id}`} className="text-ink hover:underline underline-offset-2">
                  {m.name}
                </Link>
                <span className="num ml-2 text-[13px] text-muted">
                  {formatRate(m.pricing.input)} / {formatRate(m.pricing.output)}
                </span>
                <span className="ml-2 text-[12px] text-faint">
                  {PROVIDER_LABELS[m.provider]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Panel className="mt-10 px-4 py-4">
        <h2 className="text-[15px] font-medium text-ink">Price your actual prompt</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          These figures assume a prompt size. Paste your real one and the analyser will count it
          with {model.name}&rsquo;s tokenizer family, find what is wasted, and compare against every
          other model at your volume.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center rounded border border-save/50 bg-save/10 px-3 py-1.5 text-[13px] font-medium text-save hover:bg-save/20"
        >
          Open the analyser
        </Link>
      </Panel>

      <p className="mt-8 text-[12px] text-faint">
        Prices last verified {PRICES_VERIFIED_ON}. Confirm against {PROVIDER_LABELS[model.provider]}
        &rsquo;s own pricing page before committing to anything.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-2 text-left font-normal text-muted">
        {label}
      </th>
      <td className="num px-4 py-2 text-right text-ink">{value}</td>
    </tr>
  );
}
