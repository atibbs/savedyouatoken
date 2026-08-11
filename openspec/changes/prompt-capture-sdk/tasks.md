## 1. Workspace scaffold

- [ ] 1.1 Create `packages/sdk` with `package.json` (name `@savedyouatoken/sdk`, one runtime dep `gpt-tokenizer`; dev deps `tsup`, `vitest`; Node ≥20), matching the CLI's setup
- [ ] 1.2 Add `tsconfig.json` and `tsup.config.ts` bundling to `dist/`, and a `vitest.config.ts`
- [ ] 1.3 Confirm the root workspace picks it up (packages/* glob) and `npm install` resolves it

## 2. Capture and normalisation

- [ ] 2.1 Define the normalised `CapturedRequest` shape (model, system, tools?, observedOutputTokens?, observedCacheReadTokens?, timestamp)
- [ ] 2.2 Define the `RequestAdapter` interface (pure `extract(params, response?) → CapturedRequest | null`)
- [ ] 2.3 Implement the Anthropic adapter (system string or block array; tools; usage.output_tokens, cache_read_input_tokens) — duck-typed, no SDK import
- [ ] 2.4 Implement the OpenAI adapter (system/developer message content; tools; usage.completion_tokens) — duck-typed, no SDK import

## 3. Analysis pipeline

- [ ] 3.1 Implement the shape key over the *stable* portion (model + stable(system) + tools) and a bounded LRU dedupe + sampling policy, plus multi-request stability inference and an optional caller-provided mask, so interpolated variable data (timestamp/tenant/RAG) does not mint a new shape each call
- [ ] 3.2 Implement the traffic model (rolling window → requests/day, average output tokens, cache-hit rate) mapping to core's `Workload`, with explicit overrides — collected independently of shape analysis, and re-emitting a shape's report when its estimate matures or changes materially
- [ ] 3.3 Implement model-identifier normalisation (dated/snapshot IDs → catalogue id via an alias map) with an explicit unknown-model policy that surfaces the condition rather than silently dropping the audit
- [ ] 3.4 Implement `createAuditor(adapter, opts)` with `observe(params, response)` that bridges a captured, normalised shape to core `analyze()` using an injected `gpt-tokenizer` counter — never reimplementing analysis

## 4. Result delivery (sinks)

- [ ] 4.1 Define the `AuditSink` interface and implement `consoleSink`, `fileSink`, and a `callback` sink
- [ ] 4.2 Use core's prompt-free `toSharedReport` for any off-process payload (already hardened to carry static rule summaries, not content-derived detail); assert the SDK's transmitted payload is canary-free
- [ ] 4.3 Implement the opt-in network `dashboardSink` that transmits only that payload; wire the default (console in dev, no-op in prod)

## 5. Ergonomic wrappers

- [ ] 5.1 Implement `wrapAnthropic(client)` / `wrapOpenAI(client)`: passthrough proxy that awaits the real call, returns it unchanged, then schedules `observe()` off the hot path via a deferred macrotask (`setImmediate` / `setTimeout(0)`), errors swallowed
- [ ] 5.2 Implement the opt-in fetch-level interceptor fallback for frameworks that hide request params
- [ ] 5.3 Export the public API from `src/index.ts` and write a short README with the one-line usage

## 6. Tests

- [ ] 6.1 Adapter extraction: Anthropic and OpenAI requests normalise to the expected `CapturedRequest`
- [ ] 6.2 Dedupe + stability: a repeated identical shape analyses at most per the sampling policy; a changed shape re-triggers; a prompt with an interpolated timestamp collapses to a single stable shape
- [ ] 6.3 Parity: the SDK path yields the same findings/counts/cost as calling core `analyze()` directly on the same input
- [ ] 6.4 Privacy (canary): unique strings planted in the prompt, a tool name, a tool description, and a schema never appear anywhere in the redacted off-process payload
- [ ] 6.5 Non-intrusion: the wrapper returns the real response unchanged and an `observe()` failure does not throw to the caller
- [ ] 6.6 Matured workload: an emitted report reflects accumulated (not first-request) workload, and re-emits when the estimate changes materially
- [ ] 6.7 Timing: the caller's continuation resumes before observation begins (assert ordering)
- [ ] 6.8 Model normalisation: a dated snapshot ID normalises to its catalogue model; an unmappable ID surfaces through the destination rather than silently producing no output

## 7. Verify

- [ ] 7.1 `npm run typecheck` clean across all workspaces
- [ ] 7.2 `npm test` green (existing 58 core tests plus the new SDK tests)
- [ ] 7.3 `npm run build` (web) and the SDK bundle build succeed; confirm `packages/core`, `apps/web`, and `packages/cli` are unchanged
