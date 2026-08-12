import { describe, expect, it } from 'vitest';
import { wrapAnthropic } from '../src/wrappers';
import { callbackSink } from '../src/sinks';
import { noopSink } from '../src/sinks';
import { testCounter, FIXED_WORKLOAD, anthropicRequest, flushMacrotasks } from './helpers';

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
