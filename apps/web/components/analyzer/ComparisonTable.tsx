'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PROVIDER_LABELS, formatTokens, formatUsd, type AnalysisResult } from '@savedyouatoken/core';

export function ComparisonTable({ result }: { result: AnalysisResult }) {
  const [showLegacy, setShowLegacy] = useState(false);
  const rows = result.comparison.filter((r) => showLegacy || !r.model.legacy || r.model.id === result.model.id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <p className="text-[13px] text-muted">
          Your prompt, priced on every model — with token counts re-computed per tokenizer family,
          not copied across.
        </p>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          <input
            type="checkbox"
            checked={showLegacy}
            onChange={(e) => setShowLegacy(e.target.checked)}
            className="accent-[var(--c-save)]"
          />
          Show superseded models
        </label>
      </div>

      <div className="max-h-[32rem] overflow-auto scroll-thin">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-panel text-[11px] uppercase tracking-wider text-faint">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2 text-left font-normal">
                Model
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Input tokens
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                $/month
              </th>
              <th scope="col" className="px-4 py-2 text-right font-normal">
                vs current
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const isCurrent = row.model.id === result.model.id;
              return (
                <tr key={row.model.id} className={isCurrent ? 'bg-raised' : undefined}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/models/${row.model.id}`}
                      className="text-ink hover:underline underline-offset-2"
                    >
                      {row.model.name}
                    </Link>
                    <span className="ml-2 text-[11px] text-faint">
                      {PROVIDER_LABELS[row.model.provider]}
                    </span>
                    {isCurrent ? (
                      <span className="ml-2 rounded border border-info/40 px-1 py-0.5 font-mono text-[10px] uppercase text-info">
                        current
                      </span>
                    ) : null}
                    {row.model.legacy ? (
                      <span className="ml-2 text-[11px] text-faint">superseded</span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-2 text-right text-muted">
                    {formatTokens(row.inputTokens)}
                  </td>
                  <td className="num px-3 py-2 text-right text-ink">{formatUsd(row.monthlyCost)}</td>
                  <td
                    className={`num px-4 py-2 text-right ${
                      isCurrent ? 'text-faint' : row.delta < 0 ? 'text-save' : 'text-danger'
                    }`}
                  >
                    {isCurrent ? '—' : `${row.delta > 0 ? '+' : ''}${Math.round(row.delta * 100)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
        Cost only. A cheaper model that fails your evals is not cheaper. Use this to shortlist
        candidates, then measure quality on your own task.
      </p>
    </div>
  );
}
