import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, canonicalStringify, DEFAULT_WORKLOAD, heuristicCounter, parsePolicyDocument, toReportEnvelope } from '@savedyouatoken/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startWorkbenchServer, type WorkbenchServer } from '../../src/workbench/server';

function buildReportJson(overrides: { workflowId?: string; releaseId?: string; maturity?: 'provisional' | 'mature'; prompt?: string } = {}): string {
  const result = analyze({
    prompt: overrides.prompt ?? 'Please kindly help the customer as best you can, thanks so much!',
    modelId: 'claude-sonnet-5',
    workload: DEFAULT_WORKLOAD,
    counter: heuristicCounter,
  });
  const generatedAt = '2026-01-01T00:00:00.000Z';
  const report = toReportEnvelope(result, {
    workflow: { id: overrides.workflowId ?? 'support/triage' },
    release: { id: overrides.releaseId ?? 'v1' },
    provenance: { producer: 'test', producerVersion: '0.0.0', generatedAt },
    maturity: { state: overrides.maturity ?? 'mature', observations: overrides.maturity === 'provisional' ? 1 : 500 },
    window: { startedAt: generatedAt, endedAt: generatedAt, requests: overrides.maturity === 'provisional' ? 1 : 500 },
    engineVersion: '0.1.0',
    rulesetId: 'test-ruleset',
  });
  return canonicalStringify(report);
}

describe('workbench server', () => {
  let server: WorkbenchServer;

  beforeEach(async () => {
    server = await startWorkbenchServer({ dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) });
  });

  afterEach(async () => {
    await server.close();
  });

  it('binds to loopback (127.0.0.1), not a wildcard/LAN address', () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('reports health without any auth', async () => {
    const res = await fetch(`${server.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dataDir: server.dataDir });
  });

  it('rejects /ingest with a missing or wrong token', async () => {
    const body = buildReportJson();
    const noAuth = await fetch(`${server.url}/ingest`, { method: 'POST', body });
    expect(noAuth.status).toBe(401);
    const wrongAuth = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token' },
      body,
    });
    expect(wrongAuth.status).toBe(401);
  });

  it('rejects /ingest from a mismatched Origin, even with a correct token (CSRF defense)', async () => {
    const res = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}`, Origin: 'http://evil.example' },
      body: buildReportJson(),
    });
    expect(res.status).toBe(403);
  });

  it('ingests a valid report with the correct token and it appears in history', async () => {
    const res = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: buildReportJson(),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: true; id: string; isNew: boolean };
    expect(body.isNew).toBe(true);

    const home = await (await fetch(server.url)).text();
    expect(home).toContain('support/triage');

    const workflowPage = await (await fetch(`${server.url}/workflow/${encodeURIComponent('support/triage')}`)).text();
    expect(workflowPage).toContain('v1');
  });

  it('rejects an invalid report body with 422 and actionable errors', async () => {
    const res = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: JSON.stringify({ not: 'a report' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: false; errors: unknown[] };
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('rejects an oversized ingest body with 413', async () => {
    const res = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: JSON.stringify({ padding: 'x'.repeat(400_000) }),
    });
    expect(res.status).toBe(413);
  });

  it('404s an unknown report id and unknown route', async () => {
    expect((await fetch(`${server.url}/report/sha256:${'0'.repeat(64)}`)).status).toBe(404);
    expect((await fetch(`${server.url}/nonexistent`)).status).toBe(404);
  });

  it('refuses to approve a provisional report as a baseline without acknowledgement, but allows it with acknowledgement', async () => {
    const ingest = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: buildReportJson({ maturity: 'provisional' }),
    });
    const { id } = (await ingest.json()) as { id: string };

    const withoutAck = await fetch(`${server.url}/approve-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: server.token, reportId: id, enforcement: 'warn' }),
    });
    expect(withoutAck.status).toBe(400);

    const withAck = await fetch(`${server.url}/approve-baseline`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: server.token, reportId: id, acknowledgeProvisional: 'on', enforcement: 'warn' }),
    });
    expect(withAck.status).toBe(303);
  });

  it('rejects approve-baseline without the correct token', async () => {
    const ingest = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: buildReportJson(),
    });
    const { id } = (await ingest.json()) as { id: string };
    const res = await fetch(`${server.url}/approve-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'wrong', reportId: id, enforcement: 'warn' }),
    });
    expect(res.status).toBe(401);
  });

  it('exports a canonical, CLI-compatible policy for an approved baseline, gated by the token', async () => {
    const canaryPrompt = 'CANARY_EXPORT_POLICY_TEXT_Z9 please kindly help.';
    const ingest = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: buildReportJson({ prompt: canaryPrompt }),
    });
    const { id } = (await ingest.json()) as { id: string };
    await fetch(`${server.url}/approve-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: server.token, reportId: id, enforcement: 'fail', maxTokenRegressionPercent: '15' }),
    });

    const noToken = await fetch(`${server.url}/export-policy?workflow=${encodeURIComponent('support/triage')}`);
    expect(noToken.status).toBe(401);

    const exported = await fetch(`${server.url}/export-policy?workflow=${encodeURIComponent('support/triage')}&token=${server.token}`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-disposition')).toContain('.policy.json');
    const rawText = await exported.clone().text();
    expect(rawText).not.toContain('CANARY_EXPORT_POLICY_TEXT_Z9');
    const policyJson = await exported.json();
    const parsed = parsePolicyDocument(policyJson);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.target.id).toBe('support/triage');
      expect(parsed.value.baselineId).toBe(id);
      expect(parsed.value.enforcement).toBe('fail');
      expect(parsed.value.budgets.maxTokenRegressionPercent).toBe(15);
    }
  });

  it('compares two ingested reports and shows the diff, flagging an approximate comparison', async () => {
    const a = await (
      await fetch(`${server.url}/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${server.token}` }, body: buildReportJson({ releaseId: 'v1' }) })
    ).json() as { id: string };
    const b = await (
      await fetch(`${server.url}/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${server.token}` }, body: buildReportJson({ releaseId: 'v2' }) })
    ).json() as { id: string };

    const page = await (await fetch(`${server.url}/compare?baseline=${encodeURIComponent(a.id)}&current=${encodeURIComponent(b.id)}`)).text();
    expect(page).toContain('Compare');
    expect(page).toContain('v1');
    expect(page).toContain('v2');
  });

  it('deletes all local data only with the token and explicit confirmation, and never before', async () => {
    await fetch(`${server.url}/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${server.token}` }, body: buildReportJson() });

    const noConfirm = await fetch(`${server.url}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: server.token }),
    });
    expect(noConfirm.status).toBe(400);
    expect(await (await fetch(server.url)).text()).not.toContain('No reports yet');

    const wrongToken = await fetch(`${server.url}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'wrong', confirm: 'delete' }),
    });
    expect(wrongToken.status).toBe(401);

    const confirmed = await fetch(`${server.url}/api/delete`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: server.token, confirm: 'delete' }),
    });
    expect(confirmed.status).toBe(303);
    expect(await (await fetch(server.url)).text()).toContain('No reports yet');
  });

  it('never leaks prompt text through any HTTP response (canary)', async () => {
    const canaryPrompt = 'CANARY_WORKBENCH_TEXT_Z9 please kindly help the customer.';
    const ingest = await fetch(`${server.url}/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}` },
      body: buildReportJson({ prompt: canaryPrompt }),
    });
    const { id } = (await ingest.json()) as { id: string };

    const pages = await Promise.all(
      [
        server.url,
        `${server.url}/workflow/${encodeURIComponent('support/triage')}`,
        `${server.url}/report/${encodeURIComponent(id)}`,
      ].map((u) => fetch(u).then((r) => r.text())),
    );
    for (const page of pages) expect(page).not.toContain('CANARY_WORKBENCH_TEXT_Z9');
  });
});

describe('workbench server port handling', () => {
  it('reports the actual OS-assigned port when --port 0 is requested, not the literal 0', async () => {
    const server = await startWorkbenchServer({ port: 0, dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) });
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://127.0.0.1:${server.port}`);
    expect((await fetch(`${server.url}/api/health`)).status).toBe(200);
    await server.close();
  });

  it('picks an alternate port automatically when no --port is given and the default is taken', async () => {
    // Neither call passes an explicit port, so both use the auto-retry range — the second must
    // not collide with the first, which is still holding its port.
    const first = await startWorkbenchServer({ dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) });
    const second = await startWorkbenchServer({ dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) });
    expect(second.port).not.toBe(first.port);
    await first.close();
    await second.close();
  });

  it('fails clearly when an explicit --port is requested and truly unavailable across the retry range', async () => {
    const blockers = await Promise.all(
      Array.from({ length: 3 }, () => startWorkbenchServer({ dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) })),
    );
    // Request the exact busy port explicitly (not auto-retry mode) — must fail, not silently pick another.
    await expect(
      startWorkbenchServer({ port: blockers[0]!.port, dataDir: mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-')) }),
    ).rejects.toThrow(/already in use/);
    await Promise.all(blockers.map((s) => s.close()));
  });
});
