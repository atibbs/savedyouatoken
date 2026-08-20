import { describe, expect, it, vi } from 'vitest';
import { createAuditor } from '../src/auditor';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { callbackHealthDestination } from '../src/sinks';
import type { HealthEvent, RequestAdapter } from '../src/types';
import { wrapAnthropic } from '../src/wrappers';
import { FIXED_WORKLOAD, anthropicRequest, flushMacrotasks, testCounter } from './helpers';

async function flushHealth(): Promise<void> {
  await flushMacrotasks();
  await flushMacrotasks();
  await flushMacrotasks();
}

describe('instrumentation health', () => {
  it('emits every lifecycle condition through a prompt-free destination', async () => {
    const promptCanary = 'HEALTH_PROMPT_CANARY_q9w8e7';
    const health: HealthEvent[] = [];
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: { emit() {} },
      operations: {
        workflow: { name: 'Health lifecycle' },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 0,
      },
    });
    auditor.notifyUnsupportedMethod('messages.stream');
    auditor.observe(anthropicRequest({ system: promptCanary }));
    auditor.observe({ model: 'private-custom-model', system: promptCanary });
    await flushHealth();

    expect(new Set(health.map((event) => event.kind))).toEqual(new Set([
      'initialization', 'unsupported-method', 'capture', 'analysis', 'sink-delivery', 'maturity', 'unknown-model',
    ]));
    expect(JSON.stringify(health)).not.toContain(promptCanary);
    expect(JSON.stringify(health)).not.toContain('private-custom-model');
    expect(health.find((event) => event.kind === 'unknown-model')).toMatchObject({ modelHash: expect.any(String) });
  });

  it('surfaces adapter and processing failures without throwing from observe', async () => {
    const health: HealthEvent[] = [];
    const badAdapter: RequestAdapter = {
      provider: 'broken',
      extract() { throw new Error('secret adapter failure'); },
    };
    const auditor = createAuditor(badAdapter, {
      sink: { emit() {} },
      operations: {
        workflow: { name: 'Broken adapter' },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 0,
      },
    });
    expect(() => auditor.observe({ secret: 'never emit this' })).not.toThrow();
    await flushHealth();
    expect(health).toContainEqual(expect.objectContaining({
      kind: 'capture', status: 'failed', code: 'adapter-error',
    }));
    expect(JSON.stringify(health)).not.toContain('never emit this');
    expect(JSON.stringify(health)).not.toContain('secret adapter failure');
  });

  it('reports unavailable wrapper methods without changing the client', async () => {
    const health: HealthEvent[] = [];
    const client = { messages: {} };
    const wrapped = wrapAnthropic(client, {
      env: 'production',
      operations: {
        workflow: { name: 'Unsupported method' },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 0,
      },
    });
    expect(wrapped).not.toBe(client);
    expect(wrapped.messages).toBeDefined();
    await flushHealth();
    expect(health).toContainEqual(expect.objectContaining({
      kind: 'unsupported-method', method: 'messages.create',
    }));
  });

  it('deduplicates repeated conditions and reports the suppressed count after the rate window', async () => {
    let clock = 10_000;
    const health: HealthEvent[] = [];
    const auditor = createAuditor(anthropicAdapter, {
      counter: testCounter(), workload: FIXED_WORKLOAD, sink: { emit() {} }, now: () => clock,
      operations: {
        workflow: { name: 'Rate limiting' },
        health: callbackHealthDestination((event) => health.push(event)),
        healthRateLimitMs: 1000,
      },
    });
    auditor.observe(anthropicRequest());
    auditor.observe(anthropicRequest());
    clock += 1001;
    auditor.observe(anthropicRequest());
    await flushHealth();
    const captures = health.filter((event) => event.kind === 'capture' && event.status === 'captured');
    expect(captures).toHaveLength(2);
    expect(captures[1]).toMatchObject({ suppressed: 1 });
  });

  it('keeps application timing and responses isolated from audit and health destination failures', async () => {
    const order: string[] = [];
    const response = { id: 'real', usage: { output_tokens: 10 } };
    const client = { messages: { create: async (_params: unknown) => response } };
    const wrapped = wrapAnthropic(client, {
      counter: testCounter(),
      workload: FIXED_WORKLOAD,
      sink: { async emit() { order.push('audit'); throw new Error('audit failed'); } },
      operations: {
        workflow: { name: 'Failure isolation' },
        health: { async emit(event) { order.push(`health:${event.kind}`); throw new Error('health failed'); } },
        healthRateLimitMs: 0,
      },
    });

    await expect(wrapped.messages.create(anthropicRequest())).resolves.toBe(response);
    order.push('after-await');
    expect(order).toEqual(['after-await']);
    await flushHealth();
    expect(order.indexOf('audit')).toBeGreaterThan(order.indexOf('after-await'));
    expect(order).toContain('health:sink-delivery');
  });

  it('preserves production silence with no audit or health destination configured', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const auditor = createAuditor(anthropicAdapter, {
        counter: testCounter(), workload: FIXED_WORKLOAD, env: 'production',
      });
      auditor.observe(anthropicRequest());
      await flushHealth();
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
