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

**Passthrough wrapper that observes *after* the response returns, on a deferred macrotask.**
`wrapAnthropic`/`wrapOpenAI` return the client with its create method proxied: it awaits the
real call, returns the result to the caller, and schedules `observe()` as a **deferred
macrotask** (`setImmediate`, falling back to `setTimeout(0)`), fire-and-forget and wrapped so
any throw is swallowed. A microtask is **not** sufficient: a microtask queued before the
wrapper's promise resolves drains *before* the caller's awaiting continuation, so synchronous
hashing/tokenization/analysis would still delay the caller. A macrotask lets the caller's
continuation resume first. This satisfies "non-intrusive capture" and "analysis failure never
reaches the application". Alternatives: SDK middleware hooks (not uniformly available), a
worker thread (heavier; reserved for very hot paths), and analysing before returning
(rejected — adds latency).

**Shape-keyed dedupe + sampling over the *stable* portion.** A shape key is a hash of
`model + stable(system) + tools`. Steady state with a stable prompt costs ~one structural
analysis; a genuinely changed shape re-triggers immediately — the regression signal Pro is
meant to sell. The subtlety: extracting the assembled system content does not make it static —
an interpolated timestamp, tenant id, or retrieved context would mint a new shape every call
and flood analysis. So `stable(system)` is derived by **multi-request stability inference**
(learn which segments recur across repeated requests and key only on those), with an optional
**caller-provided mask** for known-variable regions. Alternatives: key on the raw system
(defeated by any interpolation), analyse every call (wasteful), or time-based sampling only
(misses the change that matters). A bounded LRU caps memory.

**A traffic model measures the workload, decoupled from analysis emission.** Requests/day from
observed volume, average output tokens from responses, cache-hit rate from reported
cached-input usage — over a rolling window, with explicit overrides. This is the SDK's decisive
advantage over the paste box: the dollar figures stop being guesses. Crucially, traffic
collection is **separate from shape analysis**: analysing a shape once on first sight would
freeze the projection at ~one request. So collection runs continuously, and a shape's report
is (re-)emitted once its estimate has matured or changed materially — not only at first sight.
It reuses `core`'s existing `Workload` shape.

**Model-identifier normalisation with an explicit unknown policy.** Live requests carry
whatever model string the caller used — frequently a dated snapshot (`gpt-4o-2024-08-06`,
`claude-3-5-sonnet-20241022`) that is not a catalogue id. `core.analyze()` calls
`requireModel()`, which **throws** on an unknown id; combined with the wrapper swallowing
errors, that would make the SDK silently produce nothing for common real-world inputs. A small
alias/normalisation layer maps snapshot and version identifiers to their catalogue model
before analysis; an unmapped id is surfaced through the destination (a clear "unknown model"
signal) rather than dropped. Alternative — passing the raw id straight through — was the
default and is exactly the silent-failure this fixes.

**Sink abstraction with privacy-preserving defaults, over a now-safe report.**
Results go to a pluggable sink: console (dev default), file, callback, or an opt-in network
sink. The off-process payload is core's `toSharedReport(result)`, which **this PR hardens at
the source**: it previously copied each finding's human-readable `detail`, and rules
interpolate captured content into it (e.g. `packages/core/src/rules/schema.ts` embedded the
offending tool's name — "worst: `search_knowledge_base`"). It now carries the finding's static
rule `summary` instead, so the report is prompt- and tool-text-free **by construction** —
`title` and `summary` are fixed rule text, everything else is counts and figures. A canary
test (unique strings planted in prompt, tool name, description, and schema) guards it against
regression, in `packages/core` and again at the SDK boundary. Default is console in dev, no-op
in prod. Fixing the leak in core rather than in an SDK-only codec also closes the identical
latent exposure in the existing web share-link feature.

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
