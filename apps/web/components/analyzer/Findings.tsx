'use client';

import Link from 'next/link';
import { CATEGORY_LABELS, formatTokens, formatUsd, type AnalysisResult } from '@savedyouatoken/core';
import { SeverityTag, Tag } from '@/components/ui';

export function Findings({ result }: { result: AnalysisResult }) {
  if (!result.findings.length) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-ink">Nothing to flag.</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-muted">
          No waste patterns matched. That is a genuinely good result — check the{' '}
          <span className="text-ink">Models</span> tab to see whether a different model would be
          cheaper for the same prompt.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {result.findings.map((f) => (
        <li key={f.ruleId} className="px-4 py-4">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
            <SeverityTag severity={f.severity} />
            <h3 className="text-[15px] font-medium text-ink">{f.title}</h3>
            <Tag>{CATEGORY_LABELS[f.category]}</Tag>
            {f.autofix ? <Tag tone="save">auto-fixed</Tag> : <Tag tone="info">needs you</Tag>}
            {f.aggressive ? <Tag>aggressive</Tag> : null}

            <div className="ml-auto flex items-baseline gap-3 whitespace-nowrap">
              {f.tokensSaved > 0 ? (
                <span className="num text-xs text-muted">
                  {formatTokens(f.tokensSaved)} tok
                </span>
              ) : null}
              {f.monthlySaving > 0 ? (
                <span className="num text-sm font-semibold text-save">
                  {formatUsd(f.monthlySaving)}
                  <span className="text-[11px] font-normal text-faint">/mo</span>
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.detail}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="text-faint">{f.summary}</span>
            <Link
              href={`/waste/${f.ruleId}`}
              className="text-info underline decoration-info/40 underline-offset-2 hover:decoration-info"
            >
              Why this matters
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
