'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_WORKLOAD,
  EXAMPLES,
  MODELS,
  PROVIDER_LABELS,
  analyze,
  encodeReport,
  formatTokens,
  formatUsd,
  modelsByProvider,
  toSharedReport,
  type AnalysisResult,
  type CacheTtl,
} from '@savedyouatoken/core';
import { track } from '@vercel/analytics/react';
import { currentCounter, loadExactCounter } from '@/lib/tokenizer';
import { Field, Panel, Stat, Tag, buttonClass, inputClass, primaryButtonClass } from '@/components/ui';
import { Receipt } from '@/components/Receipt';
import { Findings } from './Findings';
import { RewriteView } from './RewriteView';
import { CachePanel } from './CachePanel';
import { ComparisonTable } from './ComparisonTable';
import { SavedPrompts, type SavedPrompt } from './SavedPrompts';

const DRAFT_KEY = 'syat-draft';

type Tab = 'findings' | 'rewrite' | 'cache' | 'models';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'findings', label: 'Findings' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'cache', label: 'Caching' },
  { id: 'models', label: 'Models' },
];

interface Draft {
  prompt: string;
  tools: string;
  modelId: string;
  requestsPerDay: number;
  outputTokens: number;
  cacheHitRate: number;
  cacheTtl: CacheTtl;
  batch: boolean;
  aggressive: boolean;
}

const EMPTY_DRAFT: Draft = {
  prompt: '',
  tools: '',
  modelId: DEFAULT_MODEL_ID,
  requestsPerDay: DEFAULT_WORKLOAD.requestsPerDay,
  outputTokens: DEFAULT_WORKLOAD.outputTokens,
  cacheHitRate: 0,
  cacheTtl: '5m',
  batch: false,
  aggressive: false,
};

export function Analyzer() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tab, setTab] = useState<Tab>('findings');
  const [showTools, setShowTools] = useState(false);
  const [counterReady, setCounterReady] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  // Restore the last session so returning users do not re-paste their prompt.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* a corrupt draft should not block the tool */
    }
    setHydrated(true);
  }, []);

  // The o200k vocabulary is about 2 MB, so it is fetched only once there is something to
  // count. Visitors who read the page and leave never pay for it, and the heuristic counter
  // covers the moment between the first keystroke and the tables arriving.
  const hasPrompt = draft.prompt.trim().length > 0;
  useEffect(() => {
    if (!hasPrompt || counterReady) return;
    let cancelled = false;
    void loadExactCounter().then(() => {
      if (!cancelled) setCounterReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasPrompt, counterReady]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* private browsing, quota, etc. — losing the draft is acceptable */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, hydrated]);

  // Deferring keeps typing smooth on prompts of a few thousand tokens.
  const deferredPrompt = useDeferredValue(draft.prompt);
  const deferredTools = useDeferredValue(draft.tools);

  const result = useMemo<AnalysisResult | null>(() => {
    if (!deferredPrompt.trim()) return null;
    try {
      return analyze({
        prompt: deferredPrompt,
        toolsSource: deferredTools,
        modelId: draft.modelId,
        aggressive: draft.aggressive,
        counter: currentCounter(),
        workload: {
          requestsPerDay: Math.max(0, draft.requestsPerDay || 0),
          outputTokens: Math.max(0, draft.outputTokens || 0),
          cacheHitRate: draft.cacheHitRate,
          cacheTtl: draft.cacheTtl,
          batch: draft.batch,
        },
      });
    } catch {
      return null;
    }
    // counterReady is a dependency on purpose: the numbers change when the exact
    // tokenizer finishes loading, and the analysis must re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deferredPrompt,
    deferredTools,
    draft.modelId,
    draft.aggressive,
    draft.requestsPerDay,
    draft.outputTokens,
    draft.cacheHitRate,
    draft.cacheTtl,
    draft.batch,
    counterReady,
  ]);

  // Activation signal: fire once per session the first time an analysis produces a result, so
  // the count reflects visitors who actually used the tool — not every debounced keystroke.
  const auditTracked = useRef(false);
  useEffect(() => {
    if (result && !auditTracked.current) {
      auditTracked.current = true;
      track('run_audit');
    }
  }, [result]);

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setDraft({
      ...EMPTY_DRAFT,
      prompt: ex.prompt,
      tools: ex.tools ?? '',
      modelId: ex.modelId,
      requestsPerDay: ex.requestsPerDay,
      outputTokens: ex.outputTokens,
    });
    setShowTools(Boolean(ex.tools));
    setTab('findings');
  };

  const restore = (saved: SavedPrompt) => {
    setDraft({
      ...EMPTY_DRAFT,
      prompt: saved.prompt,
      tools: saved.tools,
      modelId: saved.modelId,
      requestsPerDay: saved.requestsPerDay,
      outputTokens: saved.outputTokens,
    });
    setShowTools(Boolean(saved.tools));
  };

  // Arrow-key movement is what `role="tablist"` promises assistive technology, and a roving
  // tabindex keeps the group a single stop in the tab order.
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = TABS.findIndex((t) => t.id === tab);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? TABS.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    const target = TABS[next]!;
    setTab(target.id);
    document.getElementById(`tab-${target.id}`)?.focus();
  };

  const share = async () => {
    if (!result) return;
    const encoded = await encodeReport(toSharedReport(result));
    const url = `${window.location.origin}/r#${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2200);
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an unfocused
      // document, a permissions policy, an insecure origin. Show the link instead of
      // telling the user it failed and leaving them with nothing.
      setShareUrl(url);
      setShareState('manual');
    }
  };

  return (
    <div className="grid gap-4">
      {/* ------------------------------------------------------------ input */}
      <Panel className="shadow-acid">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
          <h2 className="eyebrow text-orange">01 / Paste</h2>
          <Tag tone="info">stays in your browser</Tag>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SavedPrompts draft={draft} onRestore={restore} />
            <label htmlFor="example-select" className="sr-only">
              Load an example prompt
            </label>
            <select
              id="example-select"
              value=""
              onChange={(e) => loadExample(e.target.value)}
              className="border border-line-strong bg-panel px-2 py-1 text-[13px] text-muted focus:outline-none focus:ring-2 focus:ring-acid"
            >
              <option value="">Load an example…</option>
              {EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {draft.prompt ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(EMPTY_DRAFT);
                  promptRef.current?.focus();
                }}
                className={buttonClass}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <label htmlFor="prompt" className="sr-only">
          System prompt
        </label>
        <textarea
          id="prompt"
          ref={promptRef}
          value={draft.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          spellCheck={false}
          placeholder={
            'Paste a system prompt here.\n\nIt is analysed entirely in this browser — nothing is uploaded, logged, or sent to a model.'
          }
          className="scroll-thin block h-64 w-full resize-y bg-transparent px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:h-72"
        />

        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            aria-expanded={showTools}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-muted hover:text-ink"
          >
            <span className="num text-xs">{showTools ? '−' : '+'}</span>
            Tool / function definitions (JSON)
            {draft.tools.trim() ? <Tag tone="save">attached</Tag> : null}
            <span className="ml-auto text-[11px] text-faint">
              tools are billed on every request
            </span>
          </button>
          {showTools ? (
            <>
              <label htmlFor="tools" className="sr-only">
                Tool definitions as JSON
              </label>
              <textarea
                id="tools"
                value={draft.tools}
                onChange={(e) => set('tools', e.target.value)}
                spellCheck={false}
                placeholder='[{"type":"function","function":{"name":"search","description":"…","parameters":{…}}}]'
                className="scroll-thin block h-40 w-full resize-y border-t border-line bg-transparent px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
              />
              {draft.tools.trim() && result?.toolTokens === 0 ? (
                <p className="border-t border-line px-4 py-2 text-[12px] text-warn">
                  That does not parse as JSON, so tools are not being counted. Paste the array you
                  pass as <code className="font-mono">tools</code>.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </Panel>

      {/* --------------------------------------------------------- controls */}
      <Panel>
        <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="model" label="Model">
            <select
              id="model"
              value={draft.modelId}
              onChange={(e) => set('modelId', e.target.value)}
              className={inputClass}
            >
              {modelsByProvider().map(([provider, models]) => (
                <optgroup key={provider} label={PROVIDER_LABELS[provider]}>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.legacy ? ' (superseded)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field id="rpd" label="Requests per day" hint="How often this prompt is sent.">
            <input
              id="rpd"
              type="number"
              min={0}
              step={100}
              value={draft.requestsPerDay}
              onChange={(e) => set('requestsPerDay', Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field id="out" label="Output tokens" hint="Average completion length.">
            <input
              id="out"
              type="number"
              min={0}
              step={50}
              value={draft.outputTokens}
              onChange={(e) => set('outputTokens', Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field
            id="hit"
            label={`Cache hit rate — ${Math.round(draft.cacheHitRate * 100)}%`}
            hint="Leave at 0 if you are not caching yet."
          >
            <div className="flex items-center gap-2">
              <input
                id="hit"
                type="range"
                min={0}
                max={100}
                value={Math.round(draft.cacheHitRate * 100)}
                onChange={(e) => set('cacheHitRate', Number(e.target.value) / 100)}
                className="w-full accent-[var(--c-save)]"
              />
              <select
                aria-label="Cache lifetime"
                value={draft.cacheTtl}
                onChange={(e) => set('cacheTtl', e.target.value as CacheTtl)}
                className="border border-line-strong bg-panel px-1.5 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-acid"
              >
                <option value="5m">5m</option>
                <option value="1h">1h</option>
              </select>
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-[12px] text-muted">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={draft.batch}
              onChange={(e) => set('batch', e.target.checked)}
              className="accent-[var(--c-save)]"
            />
            Batch API (50% off, asynchronous)
          </label>
          <span className="text-faint">
            {counterReady ? (
              <>
                Counting with{' '}
                <span className="font-mono text-muted">
                  {result?.tokenizer.counterName ?? 'o200k_base'}
                </span>
                {result?.tokenizer.accuracy === 'exact'
                  ? ' — exact for this model'
                  : ' — estimated for this family'}
              </>
            ) : hasPrompt ? (
              'Loading the tokenizer — counts are approximate until it arrives.'
            ) : (
              'The tokenizer loads when you paste something, not before.'
            )}
          </span>
        </div>
      </Panel>

      {/* ---------------------------------------------------------- results */}
      {!result ? <EmptyState onExample={loadExample} /> : null}

      {result ? (
        <>
          <Panel>
            <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
              <Stat
                label="Input tokens"
                value={formatTokens(result.inputTokens)}
                sub={
                  result.toolTokens
                    ? `${formatTokens(result.promptTokens)} prompt + ${formatTokens(result.toolTokens + result.providerToolOverhead)} tools`
                    : result.tokenizer.accuracy === 'exact'
                      ? 'exact count'
                      : 'estimated for this tokenizer'
                }
              />
              <Stat
                label="Per request"
                value={formatUsd(result.costNow.perRequest)}
                sub={`${formatUsd(result.costNow.inputPerRequest)} in + ${formatUsd(result.costNow.outputPerRequest)} out`}
              />
              <Stat
                label="Per month"
                value={formatUsd(result.costNow.perMonth)}
                sub={`${formatTokens(result.workload.requestsPerDay)} requests/day`}
              />
              <Stat
                label="Safe rewrite saves"
                tone={result.monthlyRewriteSaving > 0 ? 'save' : 'ink'}
                value={formatUsd(result.monthlyRewriteSaving)}
                sub={
                  result.tokensRemoved > 0
                    ? `−${formatTokens(result.tokensRemoved)} tokens (${result.percentRemoved.toFixed(1)}%)`
                    : 'nothing mechanical left to cut'
                }
              />
            </div>

            {result.topOpportunity ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t-[1.5px] border-line-strong bg-mint px-4 py-2.5 text-[13px] text-[#171713]">
                <span className="font-mono text-[11px] uppercase tracking-wide text-[#171713]/70">Biggest single opportunity:</span>
                <span className="font-semibold">{result.topOpportunity.title}</span>
                <span className="num font-semibold">
                  {formatUsd(result.topOpportunity.monthlySaving)}/mo
                </span>
                <button
                  type="button"
                  onClick={() => setTab('findings')}
                  className="text-info underline underline-offset-2"
                >
                  see why
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-2">
              <div
                role="tablist"
                aria-label="Analysis views"
                className="flex flex-wrap gap-1"
                onKeyDown={onTabKeyDown}
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={tab === t.id ? 0 : -1}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`border-[1.5px] px-3 py-1.5 text-[13px] transition-colors ${
                      tab === t.id
                        ? 'border-line-strong bg-acid font-bold text-[#171713]'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    {t.label}
                    {t.id === 'findings' && result.findings.length ? (
                      <span className="num ml-1.5 text-[11px] text-faint">
                        {result.findings.length}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              <a
                href="#share"
                className="ml-auto mr-1 font-mono text-[11px] text-muted underline underline-offset-2 hover:text-ink"
              >
                Share ↓
              </a>
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === 'findings' ? <Findings result={result} /> : null}
              {tab === 'rewrite' ? (
                <RewriteView
                  result={result}
                  prompt={deferredPrompt}
                  aggressive={draft.aggressive}
                  onAggressiveChange={(v) => set('aggressive', v)}
                />
              ) : null}
              {tab === 'cache' ? <CachePanel result={result} /> : null}
              {tab === 'models' ? <ComparisonTable result={result} /> : null}
            </div>
          </Panel>

          <section id="share" className="mt-6 scroll-mt-24 border-t-[1.5px] border-line-strong pt-10">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <span className="eyebrow text-orange">The flex</span>
                <h2 className="display mt-2 text-[clamp(28px,4.5vw,44px)] text-ink">
                  Send the receipt, not the prompt.
                </h2>
                <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">
                  Share the finding without showing anyone what you were working on. The link carries
                  the counts, findings and dollar figures only — your prompt never leaves this
                  browser, and there is a test that proves the payload contains no prompt text.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={share} className={primaryButtonClass}>
                    {shareState === 'copied' ? 'Link copied ✓' : 'Copy share link'}
                  </button>
                  <span className="font-mono text-[11px] text-faint">no account · no upload</span>
                </div>
                {shareState === 'manual' ? (
                  <div className="mt-3">
                    <label htmlFor="receipt-share-url" className="text-[12px] text-muted">
                      Your browser blocked the clipboard. Copy the link manually:
                    </label>
                    <input
                      id="receipt-share-url"
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className={`mt-1.5 ${inputClass} text-[11px]`}
                    />
                  </div>
                ) : null}
              </div>

              <Receipt
                modelName={result.model.name}
                inputTokens={result.inputTokens}
                monthlyNow={result.costNow.perMonth}
                recoverable={
                  result.topOpportunity
                    ? result.topOpportunity.monthlySaving
                    : result.monthlyRewriteSaving
                }
                recoverableTitle={result.topOpportunity?.title}
                createdAt={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function EmptyState({ onExample }: { onExample: (id: string) => void }) {
  return (
    <Panel className="px-4 py-8 sm:px-6">
      <h2 className="text-[15px] font-medium text-ink">Nothing to audit yet</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        Paste a system prompt above, tell it how often you send it, and you will get a priced list
        of what is wasting money — plus a rewritten version you can copy. No account, no upload, no
        model call.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onExample(e.id)}
            className="border-[1.5px] border-line-strong bg-panel px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-hard"
          >
            <div className="text-[13px] font-medium text-ink">{e.name}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{e.blurb}</p>
            <div className="num mt-2 text-[11px] text-faint">
              {MODELS.find((m) => m.id === e.modelId)?.name} ·{' '}
              {e.requestsPerDay.toLocaleString('en-US')} req/day
            </div>
          </button>
        ))}
      </div>

      <p className="mt-5 text-[12px] text-faint">
        Examples are illustrative prompts written for this tool, not real customer prompts. Prefer
        not to paste at all?{' '}
        <Link href="/cli" className="text-info underline underline-offset-2">
          Run the same analysis locally with the CLI
        </Link>
        .
      </p>
    </Panel>
  );
}
