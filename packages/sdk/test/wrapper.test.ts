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
  const realResponse = { id: 'resp_1', usage: { output_tokens: 12 } };

  // An APIPromise-like thenable. `then` and `withResponse` trigger a "parse"; `asResponse`
  // returns the raw response and parses nothing — mirroring the real OpenAI/Anthropic clients,
  // which consume through private internals, not the public `then`.
  // `catch`/`finally` are declared so the fake types like a real APIPromise; at runtime the
  // wrapper's Proxy intercepts them, so these bodies are never actually reached.
  function makeApiPromise(state: { parsed: boolean }) {
    return {
      then(onFulfilled?: ((v: unknown) => unknown) | null, onRejected?: ((r: unknown) => unknown) | null) {
        state.parsed = true;
        return Promise.resolve(realResponse).then(onFulfilled ?? undefined, onRejected ?? undefined);
      },
      catch(onRejected?: ((r: unknown) => unknown) | null) {
        return Promise.resolve(realResponse).catch(onRejected ?? undefined);
      },
      finally(onFinally?: (() => void) | null) {
        return Promise.resolve(realResponse).finally(onFinally ?? undefined);
      },
      asResponse() {
        return Promise.resolve('RAW_RESPONSE');
      },
      withResponse() {
        state.parsed = true;
        return Promise.resolve({ data: realResponse, response: 'RAW_RESPONSE' });
      },
    };
  }

  function wrappedClient() {
    const state = { parsed: false };
    const client = { responses: { create: (_params: unknown) => makeApiPromise(state) } };
    const { events, sink } = collectingSink();
    // No workload override here, so measured output length flows through from the response usage.
    const wrapped = wrapOpenAI(client, { counter: testCounter(), sink });
    return { wrapped, events, state };
  }

  it('keeps the enhanced surface and consumes nothing until the caller does', async () => {
    const { wrapped, state } = wrappedClient();
    const ret = wrapped.responses.create({ model: 'gpt-5', instructions: 'be terse' }) as ReturnType<
      typeof makeApiPromise
    >;
    expect(typeof ret.asResponse).toBe('function');
    expect(typeof ret.withResponse).toBe('function');
    expect(state.parsed).toBe(false); // creating the call parses nothing
    expect(await ret).toBe(realResponse);
    expect(state.parsed).toBe(true);
  });

  it('observes via .withResponse() even when ret is never awaited', async () => {
    const { wrapped, events } = wrappedClient();
    // Consume ONLY through the helper — never `await ret`.
    const wr = await wrapped.responses
      .create({ model: 'gpt-5', instructions: 'be terse' })
      .withResponse();
    expect(wr.data).toBe(realResponse);
    await flushMacrotasks();
    const analyses = events.filter((e: AuditEvent) => e.kind === 'analysis');
    expect(analyses).toHaveLength(1);
    // Usage from the parsed `.data` flows through (measured output length, not a default).
    if (analyses[0]!.kind === 'analysis') {
      expect(analyses[0]!.report.workload.outputTokens).toBe(12);
    }
  });

  it('observes the request alone via .asResponse(), without reading the raw body', async () => {
    const { wrapped, events } = wrappedClient();
    const raw = await wrapped.responses.create({ model: 'gpt-5', instructions: 'be terse' }).asResponse();
    expect(raw).toBe('RAW_RESPONSE');
    await flushMacrotasks();
    expect(events.filter((e: AuditEvent) => e.kind === 'analysis')).toHaveLength(1);
  });

  it('preserves native finally: rejects when the callback rejects', async () => {
    const { wrapped } = wrappedClient();
    const ret = wrapped.responses.create({ model: 'gpt-5', instructions: 'hi' });
    // Native Promise.finally waits for a returned thenable and rejects with its error, rather
    // than resolving with the model response and leaking an unhandled rejection.
    await expect(ret.finally(() => Promise.reject(new Error('cleanup failed')))).rejects.toThrow(
      'cleanup failed',
    );
  });

  it('preserves native finally: awaits an async callback, then passes the value through', async () => {
    const { wrapped } = wrappedClient();
    let ran = false;
    const value = await wrapped.responses.create({ model: 'gpt-5', instructions: 'hi' }).finally(async () => {
      await new Promise((r) => setTimeout(r, 5));
      ran = true;
    });
    expect(ran).toBe(true);
    expect(value).toBe(realResponse);
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

  it('a rejecting body read never produces an unhandled rejection', async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await withStubbedFetch(
        // Delay the real request so a naive interceptor would leave the body-read rejection
        // unhandled during the in-flight window.
        async () => {
          await new Promise((r) => setTimeout(r, 40));
          return okResponse();
        },
        async (events) => {
          const stream = new ReadableStream({
            pull(controller) {
              controller.error(new Error('stream boom'));
            },
          });
          const req = new Request('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            body: stream,
            duplex: 'half',
          } as unknown as RequestInit);
          const res = await fetch(req);
          expect(res.status).toBe(200); // the real call is unaffected
          await flushMacrotasks();
          await flushMacrotasks();
          // The failed read is swallowed: no observation, and crucially no unhandled rejection.
          expect(events).toHaveLength(0);
        },
      );
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(rejections).toEqual([]);
  });
});
