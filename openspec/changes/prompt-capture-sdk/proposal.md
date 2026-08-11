## Why

The web analyser asks you to paste your prompt — but the most expensive waste (tool
schemas, framework scaffolding, provider overhead) is machine-generated and assembled at
request time, so there often isn't a single "prompt" a human can find and copy. That
capture step is the product's biggest adoption gap: we ask users to isolate something that,
by our own thesis, is invisible to them.

Meeting the prompt where it is already fully assembled — the real outbound API call — closes
that gap. "Wrap your client, get an audit" replaces "go find and paste your opaque prompt."

## What Changes

- **New `packages/sdk` workspace** — a fourth consumer of `packages/core`, alongside
  `packages/cli`, so it runs provably identical analysis logic to the web tool and CLI.
- **Drop-in client wrappers** `wrapAnthropic(client)` / `wrapOpenAI(client)` that pass the
  real API call through untouched and audit the captured request **after** it returns, off
  the hot path (zero added latency).
- **A manual `createAuditor()` / `auditor.observe(params, response)`** entry point, plus a
  **fetch-level interceptor** fallback for frameworks that hide the request params.
- **Workload measured from real traffic** (requests/day, output tokens, cache-hit rate)
  instead of asked for — so the dollar figures are measured, not guessed.
- **Pluggable sinks** (console, file, callback, and an opt-in Pro dashboard sink) with a
  privacy-preserving default: nothing leaves the process unless explicitly configured, and
  any off-process payload passes a **redaction codec** first.
- **A redaction codec** for anything transmitted off-process — raw finding detail is not sent,
  because findings can embed captured tool names and other input-derived content.
- **Model-identifier normalisation** (dated/snapshot IDs → catalogue model) with an explicit
  unknown-model policy, so real traffic is not silently dropped.

## Capabilities

### New Capabilities
- `prompt-capture`: capturing a real outbound LLM request in the user's own process,
  normalising it across providers, and auditing it with the core engine without adding
  latency to the real call or letting prompt text leave the process by default.

### Modified Capabilities
<!-- None. packages/core is reused unchanged; its requirements do not change. -->

## Impact

- **New code:** `packages/sdk` only. Adapters (Anthropic, OpenAI), a shape-based
  sampler/dedupe, a traffic model, and sinks. Everything analytical is reused from
  `packages/core` (`analyze`, the pricing catalogue, and the prompt-free `toSharedReport`
  codec) — no reimplementation.
- **Unchanged:** `apps/web`, `packages/core`, `packages/cli`. No modifications to the web
  app, its API routes, or the engine.
- **Free-tier static/zero-cost invariant:** **no impact.** This is an opt-in developer
  library that runs in the caller's own process; it adds no server, no always-on
  infrastructure, and does not touch the web free tier.
- **New runtime dependency:** `gpt-tokenizer` only (already used by web and CLI), injected
  as the token counter. **No** dependency on `@anthropic-ai/sdk` or `openai` — adapters are
  duck-typed on the request shape, so the package is provider-version-proof. Dev-only:
  `vitest`, `tsup` (bundling, mirroring the CLI).
- **No paid service or always-on infra.** The Pro dashboard *sink interface* and its
  prompt-free POST are included, but the hosted receiving backend is a non-goal of this
  change.
- **Privacy:** prompt and tool text never leave the process by default. The underlying leak —
  `toSharedReport` copying content-derived finding `detail` — is fixed in `packages/core` as
  part of this PR: the shared report now carries only the static rule `summary`, so it is
  prompt- and tool-text-free by construction (guarded by a canary test). The SDK reuses that
  now-safe report for any off-process transmission.
