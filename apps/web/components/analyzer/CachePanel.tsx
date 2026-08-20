'use client';

import Link from 'next/link';
import {
  formatTokens,
  formatUsd,
  simulateCache,
  type AnalysisResult,
  type CacheTtl,
} from '@savedyouatoken/core';
import { useMemo, useState } from 'react';

export function CachePanel({ result }: { result: AnalysisResult }) {
  const [hitRate, setHitRate] = useState(Math.round((result.cache.hitRate || 0.8) * 100));
  const [ttl, setTtl] = useState<CacheTtl>(result.workload.cacheTtl);

  const sim = useMemo(
    () =>
      simulateCache(result.model, result.cache.staticTokens, result.cache.dynamicTokens, {
        ...result.workload,
        cacheHitRate: hitRate / 100,
        cacheTtl: ttl,
      }),
    [result, hitRate, ttl],
  );

  if (!result.cache.supported) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-ink">{result.model.name} does not offer prompt caching.</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-muted">
          Caching is the largest single lever in LLM cost control. If your workload re-sends the
          same prefix, a model that supports it is worth comparing against this one — see the
          Models tab.
        </p>
      </div>
    );
  }

  const savingPositive = sim.monthlySaving > 0;

  return (
    <div className="px-4 py-4">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h3 className="text-[15px] font-medium text-ink">What caching would do</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Everything above the first per-request value in your prompt is a candidate cache
            prefix. Here that is{' '}
            <span className="num text-ink">{formatTokens(result.cache.staticTokens)}</span> tokens,
            with <span className="num text-ink">{formatTokens(result.cache.dynamicTokens)}</span>{' '}
            changing per request.
          </p>

          <div className="mt-5">
            <label htmlFor="hit-rate" className="flex items-baseline justify-between text-[13px]">
              <span className="text-muted">Cache hit rate</span>
              <span className="num text-ink">{hitRate}%</span>
            </label>
            <input
              id="hit-rate"
              type="range"
              min={0}
              max={100}
              value={hitRate}
              onChange={(e) => setHitRate(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--c-save)]"
            />
            <p className="mt-1 text-[11px] text-faint">
              The share of requests arriving while a cache entry is still warm. Steady traffic on a
              single prefix sits high; bursty or many-tenant traffic sits lower.
            </p>
          </div>

          <div className="mt-4">
            <span className="text-[13px] text-muted">Cache lifetime</span>
            <div className="mt-1.5 flex rounded border border-line">
              {(['5m', '1h'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTtl(t)}
                  aria-pressed={ttl === t}
                  className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
                    ttl === t ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t === '5m' ? '5 minutes (1.25x write)' : '1 hour (2x write)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded border border-line bg-raised">
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-3 py-2.5 text-muted">Monthly, no caching</td>
                <td className="num px-3 py-2.5 text-right text-ink">
                  {formatUsd(sim.monthlyWithoutCache)}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-muted">Monthly, cached at {hitRate}%</td>
                <td className="num px-3 py-2.5 text-right text-ink">
                  {formatUsd(sim.monthlyWithCache)}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium text-ink">
                  {savingPositive ? 'You save' : 'This costs you'}
                </td>
                <td
                  className={`num px-3 py-2.5 text-right text-lg font-semibold ${
                    savingPositive ? 'text-save' : 'text-danger'
                  }`}
                >
                  {formatUsd(Math.abs(sim.monthlySaving))}
                  <span className="text-[11px] font-normal text-faint">/mo</span>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-muted">Breakeven</td>
                <td className="num px-3 py-2.5 text-right text-ink">
                  {sim.breakevenReads} read{sim.breakevenReads === 1 ? '' : 's'}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="border-t border-line px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            {savingPositive ? (
              <>
                A cache write costs {ttl === '1h' ? '2x' : '1.25x'} the base input rate and each
                read costs a tenth of it, so caching pays for itself after {sim.breakevenReads} read
                {sim.breakevenReads === 1 ? '' : 's'} of the same prefix.
              </>
            ) : (
              <>
                At this hit rate you would pay the {ttl === '1h' ? '2x' : '1.25x'} write surcharge
                more often than you collect the discount. Caching starts paying once a prefix is
                read {sim.breakevenReads} time{sim.breakevenReads === 1 ? '' : 's'} before it
                expires.
              </>
            )}{' '}
            <Link href="/waste/no-prompt-caching" className="text-info underline underline-offset-2">
              More on cache economics
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
