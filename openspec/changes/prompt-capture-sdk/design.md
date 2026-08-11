## Context

See `proposal.md — Why`. The analytical engine already exists in `packages/core` and is
consumed as TypeScript source by `apps/web` and `packages/cli`, so all consumers run
identical logic with no build step between them. This change adds a third consumer that
differs only in *where the input comes from*: a live API call instead of a textarea or a
file. Requirements are in `specs/prompt-capture/spec.md`.

## Goals / Non-Goals

**Goals:**
- Capture the real, fully-assembled request with a one-line integration.
- Add zero latency to the caller's real API call and never let an analysis error surface to it.
- Reuse `packages/core` verbatim — no reimplemented analysis, no divergent numbers.

**Non-Goals:**
- A hosted dashboard backend (only the sink *interface* and a prompt-free POST are in scope).
- Depending on, or version-tracking, the provider SDKs.
- Auditing per-request variable content (retrieved context, user turns); only the static,
  repeated scaffold is analysed.

## Decisions

**Consume `packages/core` as source (a 4th workspace), mirroring `packages/cli`.**
Guarantees the SDK's findings match the web tool and CLI exactly. Alternative — publishing
`core` to npm and depending on the built artifact — would add a build/release step and risk
version skew for no benefit inside the monorepo.

**Duck-typed provider adapters; no `@anthropic-ai/sdk` / `openai` dependency.** Each adapter
is a pure function reading the request/response shape structurally. This keeps the dependency
surface to one injected tokenizer and makes the package immune to provider-SDK version bumps.
Alternative — importing provider types — couples us to their release cadence and bloats deps.

**Passthrough wrapper that observes *after* the response returns, off the hot path.**
`wrapAnthropic`/`wrapOpenAI` return the client with its create method proxied: it awaits the
real call, returns the result to the caller, and schedules `observe()` on a microtask
(fire-and-forget, wrapped so any throw is swallowed). This satisfies "non-intrusive capture"
and "analysis failure never reaches the application". Alternatives considered: SDK middleware
hooks (not uniformly available), and analysing before returning (adds latency — rejected).

**Shape-keyed dedupe + sampling.** A shape key is a hash of `model + system + tools`. Steady
state with a stable prompt costs ~one analysis; a changed shape re-triggers immediately —
which is exactly the regression signal Pro is meant to sell. Alternatives: analyse every call
(wasteful, and hashes the same content repeatedly), or purely time-based sampling (misses the
change that matters). A bounded LRU caps memory.

**A traffic model measures the workload.** Requests/day from observed volume, average output
tokens from responses, cache-hit rate from reported cached-input usage — over a rolling
window, with explicit overrides. This is the SDK's decisive advantage over the paste box:
the dollar figures stop being guesses. It reuses `core`'s existing `Workload` shape.

**Sink abstraction with privacy-preserving defaults, reusing the prompt-free codec.**
Results go to a pluggable sink: console (dev default), file, callback, or an opt-in network
sink. The only network-capable sink serialises `toSharedReport(result)` — the identical
prompt-free payload the web share links use — so the privacy guarantee is the same whether a
user pastes, shares, or streams. Default is console in dev, no-op in prod. Sending anything
containing prompt text is out of the question by construction.

**Inject `gpt-tokenizer` as the counter (as the CLI does).** Keeps `core` dependency-free;
the SDK owns the one runtime dependency. Bundled with `tsup` (dev-only), Node 20+.

**A fetch-level interceptor is offered as a fallback.** For frameworks that assemble and
send requests internally (so the wrapper can't see params), an opt-in interceptor captures
the JSON body to the provider hosts. More universal, more invasive — hence opt-in, not the
default path.

## Risks / Trade-offs

- **A framework hides the request params** → the manual `createAuditor().observe(params)`
  entry point and the fetch-level interceptor fallback both cover this.
- **Streaming responses carry no usage totals** → analyse the request alone and omit
  response-derived measurements (specified), never fail.
- **Unbounded in-memory shape/traffic state** → bound the shape cache (LRU) and keep traffic
  stats in a fixed rolling window.
- **Proxying a client method could be brittle across SDK internals** → proxy only the public
  create method, keep the shim minimal, and provide `observe()` as an escape hatch that needs
  no proxying.
- **Shape hashing sees prompt content** → it stays in-process, is hashed not stored, and is
  never transmitted; consistent with the privacy invariant.

## Open Questions

- The default re-audit cadence for a long-lived stable shape (e.g. re-check every N hours to
  catch price/tokenizer changes even when the prompt is unchanged). A tunable with a sensible
  default; it does not affect the specs, the approach, or the task breakdown.
