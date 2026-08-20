'use client';

import { useMemo, useState } from 'react';
import {
  collapseDiff,
  diffFromEdits,
  formatTokens,
  formatUsd,
  type AnalysisResult,
} from '@savedyouatoken/core';
import { buttonClass, primaryButtonClass } from '@/components/ui';

export function RewriteView({
  result,
  prompt,
  aggressive,
  onAggressiveChange,
}: {
  result: AnalysisResult;
  prompt: string;
  aggressive: boolean;
  onAggressiveChange: (v: boolean) => void;
}) {
  const [view, setView] = useState<'diff' | 'result'>('diff');
  const [copied, setCopied] = useState(false);

  const segments = useMemo(
    () => collapseDiff(diffFromEdits(prompt, result.appliedEdits)),
    [prompt, result.appliedEdits],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.optimizedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <div className="flex rounded border border-line">
          {(['diff', 'result'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2.5 py-1 text-xs transition-colors ${
                view === v ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {v === 'diff' ? 'Diff' : 'Rewritten'}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={aggressive}
            onChange={(e) => onAggressiveChange(e.target.checked)}
            className="accent-[var(--c-save)]"
          />
          Aggressive (removes duplicated instructions)
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="num text-xs text-muted">
            {formatTokens(result.promptTokens)} → {formatTokens(result.optimizedTokens)} tok
            {result.tokensRemoved > 0 ? (
              <span className="text-save"> (−{result.percentRemoved.toFixed(1)}%)</span>
            ) : null}
          </span>
          <button type="button" onClick={copy} className={primaryButtonClass}>
            {copied ? 'Copied' : 'Copy rewritten prompt'}
          </button>
        </div>
      </div>

      {result.tokensRemoved === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-ink">No safe automatic rewrite available.</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-muted">
            {aggressive
              ? 'Every mechanical edit has already been applied. What remains needs a human decision — see the findings list.'
              : 'Nothing matched the lossless rewrite rules. Try aggressive mode, which also removes instructions that repeat one stated earlier.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[32rem] overflow-auto scroll-thin px-4 py-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed">
            {view === 'result' ? (
              <code className="text-ink">{result.optimizedPrompt}</code>
            ) : (
              segments.map((seg, i) => {
                if (seg.type === 'skip') {
                  return (
                    <span
                      key={i}
                      className="my-1 block select-none border-y border-line py-1 text-center text-[11px] text-faint"
                    >
                      {seg.text}
                    </span>
                  );
                }
                if (seg.type === 'removed') {
                  return (
                    <del
                      key={i}
                      className="bg-danger/15 text-danger no-underline decoration-danger/60 [text-decoration-line:line-through]"
                    >
                      {seg.text}
                    </del>
                  );
                }
                if (seg.type === 'added') {
                  return (
                    <ins key={i} className="bg-save/15 text-save no-underline">
                      {seg.text}
                    </ins>
                  );
                }
                return (
                  <span key={i} className="text-muted">
                    {seg.text}
                  </span>
                );
              })
            )}
          </pre>
        </div>
      )}

      <div className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
        The rewrite applies only mechanical, meaning-preserving edits
        {aggressive ? ' plus duplicate removal' : ''}. Worth{' '}
        <span className="num text-save">{formatUsd(result.monthlyRewriteSaving)}</span> a month at
        this volume. Review it before shipping — a prompt is production code.
      </div>
    </div>
  );
}
