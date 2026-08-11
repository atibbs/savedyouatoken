'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  decodeReport,
  formatTokens,
  formatUsd,
  getModel,
  type SharedReport as Report,
} from '@savedyouatoken/core';
import { Panel, Stat } from '@/components/ui';

type State = { status: 'loading' } | { status: 'empty' } | { status: 'bad' } | { status: 'ok'; report: Report };

export function SharedReport() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const read = async () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setState({ status: 'empty' });
        return;
      }
      const report = await decodeReport(hash);
      setState(report ? { status: 'ok', report } : { status: 'bad' });
    };
    void read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  if (state.status === 'loading') {
    return <p className="text-[14px] text-muted">Decoding report…</p>;
  }

  if (state.status === 'empty' || state.status === 'bad') {
    return (
      <Panel className="px-4 py-8">
        <h2 className="text-[15px] font-medium text-ink">
          {state.status === 'empty' ? 'No report in this link' : 'That report could not be read'}
        </h2>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
          {state.status === 'empty'
            ? 'A share link carries the report in the part of the URL after the # — which is also why the report never reaches a server. Copying the link without that fragment loses it.'
            : 'The fragment is truncated or was produced by an older version of the tool. Ask whoever shared it to re-copy the link.'}
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center rounded border border-save/50 bg-save/10 px-3 py-1.5 text-[13px] font-medium text-save hover:bg-save/20"
        >
          Run your own audit
        </Link>
      </Panel>
    );
  }

  const { report } = state;
  const model = getModel(report.modelId);
  const rewriteSaving = report.monthlyNow - report.monthlyAfterRewrite;

  return (
    <>
      <Panel>
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Stat label="Input tokens" value={formatTokens(report.inputTokens)} sub={model?.name ?? report.modelId} />
          <Stat
            label="Per month"
            value={formatUsd(report.monthlyNow)}
            sub={`${formatTokens(report.workload.requestsPerDay)} requests/day`}
          />
          <Stat
            label="Safe rewrite saves"
            tone={rewriteSaving > 0 ? 'save' : 'ink'}
            value={formatUsd(rewriteSaving)}
            sub={`−${formatTokens(report.promptTokens - report.optimizedTokens)} tokens`}
          />
          <Stat
            label="Caching would save"
            tone={report.cacheSaving > 0 ? 'save' : 'ink'}
            value={formatUsd(report.cacheSaving)}
            sub="at an 80% hit rate"
          />
        </div>
      </Panel>

      <Panel className="mt-4">
        <div className="border-b border-line px-4 py-2.5 text-[13px] text-muted">
          {report.findings.length} findings · analysed {report.createdAt}
        </div>
        <ul className="divide-y divide-line">
          {report.findings.map((f) => (
            <li key={f.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h3 className="text-[15px] font-medium text-ink">{f.title}</h3>
                <div className="ml-auto flex items-baseline gap-3 whitespace-nowrap">
                  {f.tokensSaved > 0 ? (
                    <span className="num text-xs text-muted">{formatTokens(f.tokensSaved)} tok</span>
                  ) : null}
                  {f.monthlySaving > 0 ? (
                    <span className="num text-sm font-semibold text-save">
                      {formatUsd(f.monthlySaving)}
                      <span className="text-[11px] font-normal text-faint">/mo</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.detail}</p>
              <Link
                href={`/waste/${f.id}`}
                className="mt-1.5 inline-block text-[12px] text-info underline underline-offset-2"
              >
                Why this matters
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-4 px-4 py-4">
        <h2 className="text-[15px] font-medium text-ink">This report contains no prompt text</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Share links carry only the counts, findings and figures. The prompt itself never left the
          browser it was analysed in, and never reached a server here.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center rounded border border-save/50 bg-save/10 px-3 py-1.5 text-[13px] font-medium text-save hover:bg-save/20"
        >
          Audit your own prompt
        </Link>
      </Panel>
    </>
  );
}
