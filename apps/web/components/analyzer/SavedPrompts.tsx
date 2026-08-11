'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CacheTtl } from '@savedyouatoken/core';
import { buttonClass } from '@/components/ui';
import { FREE_SAVED_LIMIT } from '@/lib/limits';

/**
 * Saved prompts are the free tier's honest boundary: the feature works, locally, and stops
 * at FREE_SAVED_LIMIT. Regression tracking across versions is what Pro adds — see /pricing.
 */
const STORAGE_KEY = 'syat-saved';

export interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  tools: string;
  modelId: string;
  requestsPerDay: number;
  outputTokens: number;
  savedAt: string;
}

interface DraftLike {
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

function read(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPrompt[]) : [];
  } catch {
    return [];
  }
}

export function SavedPrompts({
  draft,
  onRestore,
}: {
  draft: DraftLike;
  onRestore: (saved: SavedPrompt) => void;
}) {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setItems(read()), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const persist = (next: SavedPrompt[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota or private mode — the in-memory list still works for this session */
    }
  };

  const save = () => {
    if (!draft.prompt.trim() || items.length >= FREE_SAVED_LIMIT) return;
    const firstLine = draft.prompt.trim().split('\n')[0]!.slice(0, 48);
    persist([
      {
        id: crypto.randomUUID(),
        name: firstLine || 'Untitled prompt',
        prompt: draft.prompt,
        tools: draft.tools,
        modelId: draft.modelId,
        requestsPerDay: draft.requestsPerDay,
        outputTokens: draft.outputTokens,
        savedAt: new Date().toISOString().slice(0, 10),
      },
      ...items,
    ]);
    setOpen(true);
  };

  const atLimit = items.length >= FREE_SAVED_LIMIT;

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button
          type="button"
          onClick={save}
          disabled={!draft.prompt.trim() || atLimit}
          title={atLimit ? `Free plan keeps ${FREE_SAVED_LIMIT} prompts` : 'Save this prompt locally'}
          className={`${buttonClass} rounded-r-none`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`${buttonClass} -ml-px rounded-l-none px-2`}
        >
          <span className="num text-[11px] text-muted">
            {items.length}/{FREE_SAVED_LIMIT}
          </span>
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-80 rounded-lg border border-line bg-panel shadow-lg"
        >
          {items.length === 0 ? (
            <p className="px-3.5 py-4 text-[12px] leading-relaxed text-muted">
              No saved prompts yet. Saving keeps a prompt in this browser so you can re-run the
              audit after you edit it.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-auto scroll-thin">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(item);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[13px] text-ink">{item.name}</div>
                    <div className="num mt-0.5 text-[11px] text-faint">
                      {item.modelId} · saved {item.savedAt}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => persist(items.filter((i) => i.id !== item.id))}
                    aria-label={`Delete ${item.name}`}
                    className="shrink-0 px-1 text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="border-t border-line px-3.5 py-2.5 text-[11px] leading-relaxed text-faint">
            {atLimit ? (
              <>
                Free keeps {FREE_SAVED_LIMIT} prompts in this browser. Unlimited history, diffs
                between versions and CI token budgets are{' '}
                <Link href="/pricing" className="text-info underline underline-offset-2">
                  Pro
                </Link>
                .
              </>
            ) : (
              <>
                Stored in this browser only — never uploaded. Clearing site data removes them.
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
