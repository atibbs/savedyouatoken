import { describe, expect, it } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { callbackHealthDestination, localWorkbenchSink } from '../src/sinks';
import type { AuditEvent } from '../src/types';
import { collectingSink, testCounter, FIXED_WORKLOAD, flushMacrotasks } from './helpers';

const CANARY = 'CANARY_WORKBENCH_SINK_TEXT_a1b2c3';

function cannedRequest() {
  return { model: 'claude-sonnet-5', system: `You are helpful. Please be very very thorough. ${CANARY}` };
}

/** A real captured analysis event, reused across tests that exercise the sink's own retry and
 *  transport behavior in isolation from the auditor. */
function capturedEvent(): Promise<AuditEvent> {
  const { events, sink } = collectingSink();
  const auditor = createAuditor(anthropicAdapter, { counter: testCounter(), workload: FIXED_WORKLOAD, sink });
  auditor.observe(cannedRequest());
  return flushMacrotasks().then(() => {
    const event = events.find((e) => e.kind === 'analysis');
    if (!event) throw new Error('expected an analysis event');
    return event;
  });
}

describe('localWorkbenchSink', () => {
  it('POSTs the bare portable report with a bearer token, and nothing prompt-derived', async () => {
    const event = await capturedEvent();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 201 });
    };

    await localWorkbenchSink({ token: 'test-token', fetchImpl }).emit(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://127.0.0.1:4590/ingest');
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token');
    expect(headers['content-type']).toBe('application/json');
    const body = String(calls[0]!.init?.body);
    expect(body).not.toContain(CANARY);
    expect(JSON.parse(body)).toMatchObject({ contract: { kind: 'report' } });
  });

  it('respects a custom url', async () => {
    const event = await capturedEvent();
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      calls.push(String(url));
      return new Response('{}', { status: 200 });
    };
    await localWorkbenchSink({ token: 't', url: 'http://127.0.0.1:9999/ingest', fetchImpl }).emit(event);
    expect(calls).toEqual(['http://127.0.0.1:9999/ingest']);
  });

  it('skips unknown-model events — there is no report to store', async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response('{}', { status: 200 });
    };
    await localWorkbenchSink({ token: 't', fetchImpl }).emit({
      kind: 'unknown-model',
      shapeKey: 'x',
      rawModel: 'some-future-model',
      operations: {
        workflow: { id: 'w', name: 'w' },
        release: {},
        comparison: { contractVersion: { major: 1, minor: 0 }, sdkVersion: '0.0.0', engineVersion: '0.0.0', rulesetId: 'r', modelCatalogueDate: '2026-01-01' },
        configurationMode: 'legacy',
      },
    } as AuditEvent);
    expect(called).toBe(false);
  });

  it('retries a bounded number of times with backoff before succeeding', async () => {
    const event = await capturedEvent();
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts++;
      if (attempts < 3) throw new Error('ECONNREFUSED');
      return new Response('{}', { status: 201 });
    };

    await localWorkbenchSink({ token: 't', maxRetries: 3, retryDelayMs: 1, fetchImpl }).emit(event);
    expect(attempts).toBe(3);
  });

  it('retries on a non-OK HTTP status too, not just a thrown network error', async () => {
    const event = await capturedEvent();
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts++;
      return attempts < 2 ? new Response('workbench not ready', { status: 503 }) : new Response('{}', { status: 200 });
    };
    await localWorkbenchSink({ token: 't', maxRetries: 2, retryDelayMs: 1, fetchImpl }).emit(event);
    expect(attempts).toBe(2);
  });

  it('throws after exhausting retries, so the auditor reports a real sink-delivery failure', async () => {
    const event = await capturedEvent();
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts++;
      throw new Error('ECONNREFUSED');
    };

    await expect(localWorkbenchSink({ token: 't', maxRetries: 2, retryDelayMs: 1, fetchImpl }).emit(event)).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(attempts).toBe(3); // 1 initial + 2 retries, bounded — not unbounded
  });

  it('surfaces sink failure through the auditor health destination, end to end', async () => {
    const health: unknown[] = [];
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: localWorkbenchSink({ token: 't', maxRetries: 0, retryDelayMs: 1, fetchImpl }),
      operations: {
        workflow: { name: 'Workbench sink health' },
        health: callbackHealthDestination((e) => void health.push(e)),
        healthRateLimitMs: 0,
      },
    });
    auditor.observe(cannedRequest());
    await flushMacrotasks();
    await flushMacrotasks();

    const delivery = health.find((e) => (e as { kind: string }).kind === 'sink-delivery');
    expect(delivery).toMatchObject({ kind: 'sink-delivery', status: 'failed' });
  });
});
