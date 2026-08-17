import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MARKER,
  findExistingCommentId,
  postOrUpdateComment,
  renderMarkdown,
  writeSummaryFallback,
} from '../../../../scripts/post-regression-comment.mjs';

const policyFail = {
  schema: 'savedyouatoken.cli/policy-check',
  target: { id: 'support/triage' },
  enforcement: 'fail',
  outcome: 'fail',
  breaches: [{ budget: 'maxInputTokens', actual: 2000, limit: 1500 }],
  diff: {
    compatibility: { status: 'exact', reasons: [] },
    tokens: { inputTokens: { baseline: 1500, current: 2000, delta: 500, percent: 33.3 } },
    cost: { monthlyNow: { baseline: 200, current: 260, delta: 60, percent: 30 } },
    findings: [{ ruleId: 'few-shot-bloat', status: 'new' }],
  },
};

// An 'approximate' (or 'exact') diff always carries tokens/cost/findings — only 'invalid' omits
// them (see packages/core/src/regression.ts). This is a plain `compare` result with no policy
// attached, so it has no `outcome`/`breaches`.
const comparePassNoBaseline = {
  schema: 'savedyouatoken.cli/compare',
  workflow: { id: 'rag/answerer' },
  diff: {
    compatibility: { status: 'approximate', reasons: ['provisional-workload'] },
    tokens: { inputTokens: { baseline: 800, current: 800, delta: 0, percent: 0 } },
    cost: { monthlyNow: { baseline: 90, current: 90, delta: 0, percent: 0 } },
    findings: [],
  },
};

describe('renderMarkdown', () => {
  it('includes the stable marker for idempotent updates', () => {
    expect(renderMarkdown([policyFail])).toContain(MARKER);
  });

  it('formats dollar amounts the same way the CLI itself does (matches packages/core/src/cost.ts formatUsd)', () => {
    const large = { ...policyFail, diff: { ...policyFail.diff, cost: { monthlyNow: { baseline: 200, current: 12345, delta: 12145, percent: 6072.5 } } } };
    const tiny = { ...policyFail, diff: { ...policyFail.diff, cost: { monthlyNow: { baseline: 0, current: 0.003, delta: 0.003, percent: null } } } };
    expect(renderMarkdown([large])).toContain('$12,345');
    expect(renderMarkdown([large])).not.toContain('$12345.00');
    expect(renderMarkdown([tiny])).toContain('$0.003');
    expect(renderMarkdown([tiny])).not.toContain('$0.00 |');
  });

  it('groups by asset and shows the outcome badge, deltas, breaches, and next actions', () => {
    const body = renderMarkdown([policyFail]);
    expect(body).toContain('support/triage');
    expect(body).toContain('❌ fail');
    expect(body).toContain('maxInputTokens');
    expect(body).toContain('+500');
    expect(body).toContain('policy generate --baseline');
  });

  it('surfaces an approximate-comparison caveat without a policy outcome', () => {
    const body = renderMarkdown([comparePassNoBaseline]);
    expect(body).toContain('rag/answerer');
    expect(body).toContain('Approximate comparison');
    expect(body).not.toContain('undefined');
  });

  it('sorts multiple assets deterministically by id', () => {
    const body = renderMarkdown([
      { ...policyFail, target: { id: 'zzz/last' } },
      { ...policyFail, target: { id: 'aaa/first' } },
    ]);
    expect(body.indexOf('aaa/first')).toBeLessThan(body.indexOf('zzz/last'));
  });
});

describe('findExistingCommentId', () => {
  it('finds a marker-bearing comment among others', () => {
    const comments = [{ id: 1, body: 'unrelated' }, { id: 2, body: `${MARKER}\nold report` }];
    expect(findExistingCommentId(comments)).toBe(2);
  });

  it('returns null when no comment carries the marker', () => {
    expect(findExistingCommentId([{ id: 1, body: 'unrelated' }])).toBeNull();
  });
});

describe('postOrUpdateComment (idempotency and permission fallback)', () => {
  let eventPath: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'savedyouatoken-gh-'));
    eventPath = join(dir, 'event.json');
    writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 42 } }));
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'atibbs/savedyouatoken';
    process.env.GITHUB_EVENT_PATH = eventPath;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_PATH;
  });

  it('creates a new comment when none exists yet', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        if (init?.method === undefined) return jsonResponse([]); // GET list
        return jsonResponse({ id: 99 });
      }),
    );

    const action = await postOrUpdateComment('body');
    expect(action).toBe('created');
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('updates the existing marker comment instead of creating a duplicate (idempotent rerun)', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        if (init?.method === undefined) return jsonResponse([{ id: 7, body: `${MARKER}\nprevious` }]);
        return jsonResponse({ id: 7 });
      }),
    );

    const action = await postOrUpdateComment('body v2');
    expect(action).toBe('updated');
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('/issues/comments/7'))).toBe(true);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('paginates past a full first page to find the marker comment, instead of posting a duplicate', async () => {
    // Regression test: a PR with >100 comments previously only ever saw page 1, so a marker
    // comment living on page 2 was invisible and every rerun posted a new duplicate comment.
    const fullPageOfOthers = Array.from({ length: 100 }, (_, i) => ({ id: i, body: `unrelated comment ${i}` }));
    const secondPage = [{ id: 999, body: `${MARKER}\nprevious` }];
    const getCalls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === undefined) {
          getCalls.push(url);
          if (url.includes('page=2')) return jsonResponse(secondPage);
          return jsonResponse(fullPageOfOthers);
        }
        return jsonResponse({ id: 999 });
      }),
    );

    const action = await postOrUpdateComment('body v3');
    expect(action).toBe('updated');
    expect(getCalls.some((u) => u.includes('page=1'))).toBe(true);
    expect(getCalls.some((u) => u.includes('page=2'))).toBe(true);
  });

  it('stops paginating as soon as a page comes back short (no unnecessary requests)', async () => {
    const getCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === undefined) {
          getCalls.push(url);
          return jsonResponse([{ id: 1, body: 'short page, well under 100' }]);
        }
        return jsonResponse({ id: 1 });
      }),
    );

    await postOrUpdateComment('body');
    expect(getCalls).toHaveLength(1);
  });

  it('throws on an API failure (e.g. missing pull-requests: write permission), so the caller can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Resource not accessible by integration' }, 403)));
    await expect(postOrUpdateComment('body')).rejects.toThrow('403');
  });

  it('the permission-fallback path writes the full report to the job summary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'savedyouatoken-summary-'));
    const summaryPath = join(dir, 'summary.md');
    process.env.GITHUB_STEP_SUMMARY = summaryPath;
    writeFileSync(summaryPath, '');

    writeSummaryFallback(renderMarkdown([policyFail]), '403 Forbidden');

    const summary = readFileSync(summaryPath, 'utf8');
    expect(summary).toContain('Comment not posted (403 Forbidden)');
    expect(summary).toContain(MARKER);
    expect(summary).toContain('support/triage');
    delete process.env.GITHUB_STEP_SUMMARY;
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
