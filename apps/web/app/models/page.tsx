import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MODELS,
  PRICES_VERIFIED_ON,
  PROVIDER_LABELS,
  formatRate,
  modelsByProvider,
} from '@savedyouatoken/core';

export const metadata: Metadata = {
  title: 'LLM API prices — Anthropic, OpenAI and Google, side by side',
  description: `Input, output, cache-read and cache-write prices per million tokens for ${MODELS.length} models across Anthropic, OpenAI and Google. Verified ${PRICES_VERIFIED_ON}.`,
  alternates: { canonical: '/models' },
};

export default function ModelsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Model prices</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        Every price the analyser uses, in one table. USD per million tokens, first-party API,
        default routing. Transcribed by hand from published pricing pages and last verified{' '}
        <span className="num text-ink">{PRICES_VERIFIED_ON}</span>.
      </p>
      <p className="mt-3 max-w-2xl text-[13px] text-faint">
        Cache-write columns are what a provider charges to place content in the prompt cache;
        cache-read is what it charges to reuse it. Where a provider publishes no write surcharge,
        writes are billed at the base input rate.
      </p>

      <div className="mt-10 space-y-10">
        {modelsByProvider().map(([provider, models]) => (
          <section key={provider}>
            <h2 className="text-[13px] uppercase tracking-wider text-faint">
              {PROVIDER_LABELS[provider]}
            </h2>
            <div className="mt-3 overflow-x-auto scroll-thin rounded-lg border border-line bg-panel">
              <table className="w-full min-w-[42rem] text-[13px]">
                <thead className="text-[11px] uppercase tracking-wider text-faint">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-4 py-2 text-left font-normal">
                      Model
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">
                      Input
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">
                      Output
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">
                      Cache read
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">
                      Cache write
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-normal">
                      Context
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={`/models/${m.id}`}
                          className="text-ink hover:underline underline-offset-2"
                        >
                          {m.name}
                        </Link>
                        {m.legacy ? (
                          <span className="ml-2 text-[11px] text-faint">superseded</span>
                        ) : null}
                      </td>
                      <td className="num px-3 py-2 text-right text-ink">{formatRate(m.pricing.input)}</td>
                      <td className="num px-3 py-2 text-right text-ink">{formatRate(m.pricing.output)}</td>
                      <td className="num px-3 py-2 text-right text-muted">
                        {formatRate(m.pricing.cacheRead)}
                      </td>
                      <td className="num px-3 py-2 text-right text-muted">
                        {formatRate(m.pricing.cacheWrite5m)}
                      </td>
                      <td className="num px-4 py-2 text-right text-muted">
                        {m.contextWindow ? `${(m.contextWindow / 1000).toLocaleString('en-US')}k` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-line bg-panel px-4 py-4">
        <h2 className="text-[15px] font-medium text-ink">Price per million is not price per request</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Models count tokens differently. Claude models from Opus 4.7 onward produce roughly 30%
          more tokens for identical text than earlier ones, so two models at the same headline rate
          can differ meaningfully on the same prompt. To compare what you will actually pay, price
          your own prompt.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center rounded border border-save/50 bg-save/10 px-3 py-1.5 text-[13px] font-medium text-save hover:bg-save/20"
        >
          Compare on your prompt
        </Link>
      </div>
    </div>
  );
}
