import { createAuditor, type Auditor } from './auditor';
import { anthropicAdapter } from './adapters/anthropic';
import { openaiAdapter } from './adapters/openai';
import type { AuditorOptions } from './types';

/**
 * Schedule work as a *deferred macrotask*. A microtask is not sufficient: a microtask queued
 * before the wrapper's promise resolves drains before the caller's awaiting continuation, so
 * synchronous hashing/analysis would still delay the caller. A macrotask lets the caller's
 * continuation resume first — the whole point of "zero added latency".
 */
const scheduleMacrotask: (cb: () => void) => void =
  typeof setImmediate === 'function' ? (cb) => void setImmediate(cb) : (cb) => void setTimeout(cb, 0);

/** Fire-and-forget an observation off the hot path, swallowing any error. */
function scheduleObserve(auditor: Auditor, params: unknown, response: unknown): void {
  scheduleMacrotask(() => {
    try {
      auditor.observe(params, response);
    } catch {
      // Analysis failure must never reach the application.
    }
  });
}

type Fn = (...args: unknown[]) => unknown;

/**
 * Return a Proxy over a thenable that behaves identically — every property passes straight
 * through, and the caller keeps the original enhanced object's full surface — while invoking
 * `onResolved(value)` exactly once, whichever way the caller consumes it. It never resolves the
 * thenable itself, so nothing is consumed until the caller consumes it.
 *
 * The provider SDKs consume through private internals (`parse()` / `responsePromise`), not their
 * public `then`, so every consumption path has to be tapped, not just `then`:
 *  - `then` / `catch` / `finally` route through a wrapped `then` that taps the resolved value;
 *  - `withResponse()` taps the parsed `.data` (which carries usage);
 *  - `asResponse()` returns the raw, unparsed response — so it taps the *request alone* and
 *    never touches the body.
 */
function tapThenable<T extends PromiseLike<unknown>>(thenable: T, onResolved: (value: unknown) => void): T {
  let tapped = false;
  const tapOnce = (value: unknown): void => {
    if (tapped) return;
    tapped = true;
    onResolved(value);
  };

  const wrappedThen = (
    onFulfilled?: ((v: unknown) => unknown) | null,
    onRejected?: ((r: unknown) => unknown) | null,
  ) =>
    (thenable as PromiseLike<unknown>).then((value) => {
      tapOnce(value);
      return onFulfilled ? onFulfilled(value) : value;
    }, onRejected ?? undefined);

  return new Proxy(thenable, {
    get(obj, prop, receiver) {
      switch (prop) {
        case 'then':
          return wrappedThen;
        case 'catch':
          return (onRejected?: ((r: unknown) => unknown) | null) => wrappedThen(undefined, onRejected);
        case 'finally':
          // Native `finally` awaits a thenable returned by the callback and rejects with its
          // error; discarding the return value (and swallowing an async rejection) would change
          // application behaviour and can crash Node with an unhandled rejection. `await`
          // assimilates the callback result so those semantics are preserved.
          return (onFinally?: (() => unknown) | null) =>
            wrappedThen(
              async (v) => {
                if (onFinally) await onFinally();
                return v;
              },
              async (r) => {
                if (onFinally) await onFinally();
                throw r;
              },
            );
        case 'withResponse': {
          const fn = Reflect.get(obj, prop, receiver);
          if (typeof fn !== 'function') return fn;
          return (...args: unknown[]) =>
            Promise.resolve((fn as Fn).apply(obj, args)).then((result) => {
              tapOnce((result as { data?: unknown } | undefined)?.data);
              return result;
            });
        }
        case 'asResponse': {
          const fn = Reflect.get(obj, prop, receiver);
          if (typeof fn !== 'function') return fn;
          return (...args: unknown[]) =>
            Promise.resolve((fn as Fn).apply(obj, args)).then((rawResponse) => {
              tapOnce(undefined); // raw response: observe the request alone, never read the body
              return rawResponse;
            });
        }
        default: {
          const value = Reflect.get(obj, prop, receiver);
          return typeof value === 'function' ? value.bind(obj) : value;
        }
      }
    },
  });
}

/**
 * Return a Proxy over `target` that behaves identically, except the method at `path` (e.g.
 * `['messages', 'create']`) is wrapped: it awaits the real call, returns the result to the
 * caller unchanged, then schedules an observation. Intermediate objects are proxied lazily;
 * every other property passes through, with methods bound to the real object so provider-SDK
 * private fields keep working. Only the public create method is touched.
 */
function instrument<T extends object>(target: T, path: string[], auditor: Auditor): T {
  const [head, ...rest] = path;
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (prop !== head) {
        return typeof value === 'function' ? value.bind(obj) : value;
      }

      if (rest.length > 0) {
        return value && typeof value === 'object' ? instrument(value as object, rest, auditor) : value;
      }

      // Leaf: the create method.
      if (typeof value !== 'function') return value;
      const fn = value as (...args: unknown[]) => unknown;
      return function instrumentedCreate(...args: unknown[]) {
        const params = args[0];
        const ret = fn.apply(obj, args);
        if (!ret || typeof (ret as { then?: unknown }).then !== 'function') {
          // Non-promise return (e.g. a stream object): observe the request alone.
          scheduleObserve(auditor, params, undefined);
          return ret;
        }
        // The provider SDKs return an enhanced `APIPromise` with public helpers like
        // `.asResponse()` / `.withResponse()`. Replacing it with `ret.then(...)` would strip
        // those and eagerly parse the body. Instead, return a Proxy over the original object:
        // every helper passes through untouched, and observation piggybacks on the caller's own
        // `.then`/`await` — so nothing is consumed until the caller consumes it, exactly once.
        return tapThenable(ret as PromiseLike<unknown>, (response) =>
          scheduleObserve(auditor, params, response),
        );
      };
    },
  });
}

/**
 * Wrap an Anthropic client so every `messages.create` is audited after it returns, off the hot
 * path. The client's requests and responses are unchanged; an audit failure never surfaces.
 */
export function wrapAnthropic<T extends object>(client: T, options?: AuditorOptions): T {
  const auditor = createAuditor(anthropicAdapter, options);
  return instrument(client, ['messages', 'create'], auditor);
}

/**
 * Wrap an OpenAI client so `chat.completions.create` and `responses.create` are audited after
 * they return, off the hot path. Both request styles are covered; unchanged clients that lack
 * one path simply pass through.
 */
export function wrapOpenAI<T extends object>(client: T, options?: AuditorOptions): T {
  const auditor = createAuditor(openaiAdapter, options);
  const withChat = instrument(client, ['chat', 'completions', 'create'], auditor);
  return instrument(withChat, ['responses', 'create'], auditor);
}

const PROVIDER_HOSTS: Array<{ match: RegExp; adapter: typeof anthropicAdapter }> = [
  { match: /api\.anthropic\.com/, adapter: anthropicAdapter },
  { match: /api\.openai\.com/, adapter: openaiAdapter },
];

/**
 * Opt-in fallback for frameworks that assemble and send requests internally, where the client
 * wrapper cannot see the params. Monkeypatches `globalThis.fetch` to capture the JSON body of
 * requests to known provider hosts and audit them after the response returns. More universal,
 * more invasive — hence opt-in, not a default. Returns an uninstall function.
 */
export function installFetchInterceptor(options?: AuditorOptions): () => void {
  const original = globalThis.fetch;
  if (typeof original !== 'function') return () => {};

  const auditors = new Map<string, Auditor>();
  const auditorFor = (provider: string, adapter: typeof anthropicAdapter): Auditor => {
    let a = auditors.get(provider);
    if (!a) {
      a = createAuditor(adapter, options);
      auditors.set(provider, a);
    }
    return a;
  };

  const patched: typeof fetch = async (input, init) => {
    // Kick off body capture WITHOUT awaiting it, then dispatch the real request immediately —
    // adding latency to the real call would break the zero-added-latency contract, and matters
    // most for a large or streamed body. For the `fetch(new Request(...))` overload the body
    // lives on the Request and the real call consumes it, so we clone *now* (synchronous) and
    // read the clone concurrently; the read is awaited only after the response returns.
    let capture: { provider: (typeof PROVIDER_HOSTS)[number]; bodyText: Promise<string | undefined> } | undefined;
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const provider = PROVIDER_HOSTS.find((h) => h.match.test(url));
      if (provider) {
        let bodyText: Promise<string | undefined> | undefined;
        if (typeof init?.body === 'string') bodyText = Promise.resolve(init.body);
        else if (typeof Request !== 'undefined' && input instanceof Request) {
          // Attach the rejection handler *immediately*, not after the response returns: the read
          // can reject while the real request is still in flight, and an unhandled rejection in
          // that window would crash the process under Node's default behaviour. The read still
          // proceeds concurrently; a failure just becomes `undefined` (capture skipped).
          bodyText = input
            .clone()
            .text()
            .then(
              (t) => t,
              () => undefined,
            );
        }
        if (bodyText) capture = { provider, bodyText };
      }
    } catch {
      // Reading the body must never disturb the real request.
    }

    const response = await original.call(globalThis, input, init);

    if (capture) {
      try {
        const { provider, bodyText } = capture;
        const auditor = auditorFor(provider.adapter.provider, provider.adapter);
        // Combine the (already in-flight, already-handled) body read with a clone of the
        // response, off the hot path. The caller's response is returned below untouched, before
        // any of this resolves. The whole block is guarded: `response.clone()` *throws
        // synchronously* on a locked/disturbed body, and since `patched` is async that throw
        // would otherwise become a rejection the caller receives instead of their response.
        const responseJson = Promise.resolve(response.clone().json()).catch(() => undefined);
        Promise.all([bodyText, responseJson])
          .then(([body, parsed]) => {
            if (body == null) return;
            scheduleObserve(auditor, JSON.parse(body), parsed);
          })
          .catch(() => {
            // A malformed body must never surface to the caller.
          });
      } catch {
        // Interception must never disturb the real request.
      }
    }
    return response;
  };

  globalThis.fetch = patched;
  return () => {
    if (globalThis.fetch === patched) globalThis.fetch = original;
  };
}
