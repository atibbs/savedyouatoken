import { describe, expect, it } from 'vitest';
import { wrapAnthropic, wrapOpenAI, installFetchInterceptor } from '../src/wrappers';
import { callbackSink } from '../src/sinks';
import { noopSink } from '../src/sinks';
import type { AuditEvent } from '../src/types';
import { collectingSink, testCounter, FIXED_WORKLOAD, anthropicRequest, flushMacrotasks } from './helpers';

const base = { counter: testCounter(), workload: FIXED_WORKLOAD, sink: noopSink };

describe('non-intrusive capture', () => {
  it('returns the real response unchanged and passes the params through untouched', async () => {
    const realResponse = { id: 'msg_1', usage: { output_tokens: 10 } };
    let seenParams: unknown;
    const client = {
      messages: {
        create: async (params: unknown) => {
          seenParams = params;
          return realResponse;
        },
      },
    };
    const wrapped = wrapAnthropic(client, base);

    const req = anthropicRequest();
    const result = await wrapped.messages.create(req);

    expect(result).toBe(realResponse); // exact identity — untouched
    expect(seenParams).toBe(req);
  });

  it('does not let an observation failure reach the caller', async () => {
    const client = { messages: { create: async (_params: unknown) => ({ usage: { output_tokens: 1 } }) } };
    const wrapped = wrapAnthropic(client, {
      ...base,
      sink: {
        emit() {
          throw new Error('sink boom');
        },
      },
    });

    // The call resolves normally despite the sink throwing during the deferred observation.
    await expect(wrapped.messages.create(anthropicRequest())).resolves.toBeDefined();
    await flushMacrotasks(); // let the throwing observation run; it must be swallowed
  });

  it('resumes the caller continuation before observation begins', async () => {
    const order: string[] = [];
    const client = { messages: { create: async (_params: unknown) => ({ usage: { output_tokens: 1 } }) } };
    const wrapped = wrapAnthropic(client, {
      ...base,
      sink: callbackSink(() => order.push('observe')),
    });

    await wrapped.messages.create(anthropicRequest());
    order.push('after-await');
    await flushMacrotasks();

    expect(order).toEqual(['after-await', 'observe']);
  });
});

describe('preserves the provider APIPromise', () => {
  it('keeps .asResponse()/.withResponse() and does not consume the body until the caller does', async () => {
    const realResponse = { id: 'resp_1', usage: { output_tokens: 12 } };
    let bodyParsed = false;

    // An APIPromise-like thenable: `then` is what triggers body parsing; the helpers do not.
    function makeApiPromise() {
      return {
        then(onFulfilled?: ((v: unknown) => unknown) | null, onRejected?: ((r: unknown) => unknown) | null) {
          bodyParsed = true;
          return Promise.resolve(realResponse).then(onFulfilled ?? undefined, onRejected ?? undefined);
        },
        asResponse: () => 'RAW_RESPONSE',
        withResponse: async () => ({ data: realResponse, response: 'RAW_RESPONSE' }),
      };
    }

    const client = { responses: { create: (_params: unknown) => makeApiPromise() } };
    const { events, sink } = collectingSink();
    const wrapped = wrapOpenAI(client, { ...base, sink });

    const ret = wrapped.responses.create({ model: 'gpt-5', instructions: 'be terse' }) as ReturnType<
      typeof makeApiPromise
    >;

    // The enhanced surface survives instrumentation…
    expect(typeof ret.asResponse).toBe('function');
    expect(typeof ret.withResponse).toBe('function');
    expect(ret.asResponse()).toBe('RAW_RESPONSE');
    // …and nothing was consumed just by creating or calling a raw helper.
    expect(bodyParsed).toBe(false);

    const data = await ret;
    expect(data).toBe(realResponse);
    expect(bodyParsed).toBe(true);

    await flushMacrotasks();
    expect(events.some((e: AuditEvent) => e.kind === 'analysis')).toBe(true);
  });
});

describe('fetch interceptor', () => {
  async function withStubbedFetch(
    handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    fn: (events: AuditEvent[]) => Promise<void>,
  ) {
    const original = globalThis.fetch;
    const events: AuditEvent[] = [];
    globalThis.fetch = handler as typeof fetch;
    const uninstall = installFetchInterceptor({ ...base, sink: callbackSink((e) => events.push(e)) });
    try {
      await fn(events);
    } finally {
      uninstall();
      globalThis.fetch = original;
    }
  }

  const okResponse = () =>
    new Response(JSON.stringify({ usage: { completion_tokens: 7 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  it('reads the body carried by a Request object (init undefined)', async () => {
    await withStubbedFetch(
      async () => okResponse(),
      async (events) => {
        const req = new Request('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-5', messages: [{ role: 'system', content: 'be terse' }] }),
        });
        const res = await fetch(req);
        expect(res.status).toBe(200);
        // The caller's Request body is untouched (we cloned before the real fetch ran).
        expect(await req.text()).toContain('be terse');
        await flushMacrotasks();
        await flushMacrotasks();
        expect(events.some((e) => e.kind === 'analysis')).toBe(true);
      },
    );
  });

  it('reads the body from init.body (fetch(url, { body }))', async () => {
    await withStubbedFetch(
      async () => okResponse(),
      async (events) => {
        await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-5', messages: [{ role: 'system', content: 'be terse' }] }),
        });
        await flushMacrotasks();
        await flushMacrotasks();
        expect(events.some((e) => e.kind === 'analysis')).toBe(true);
      },
    );
  });

  it('ignores requests to non-provider hosts', async () => {
    await withStubbedFetch(
      async () => okResponse(),
      async (events) => {
        await fetch('https://example.com/api', { method: 'POST', body: JSON.stringify({ model: 'gpt-5' }) });
        await flushMacrotasks();
        await flushMacrotasks();
        expect(events).toHaveLength(0);
      },
    );
  });
});
