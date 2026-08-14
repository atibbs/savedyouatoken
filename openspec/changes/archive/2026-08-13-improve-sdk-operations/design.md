## Context

The SDK already deduplicates request shapes, measures rolling workload, emits prompt-free reports,
and isolates capture failures from application calls. Operators currently lack a durable workflow
name, deployment context, understandable maturity progression, and a safe way to diagnose silence or
shape churn.

## Goals / Non-Goals

**Goals:**

- Add enough context to operate and compare instrumentation across releases.
- Make expected silence distinguishable from failed instrumentation.
- Preserve failure isolation, prompt privacy, and low overhead.

**Non-Goals:**

- Store raw prompts or arbitrary metadata.
- Add a hosted account requirement.
- Guarantee application quality after a cost optimization.

## Decisions

**Use an explicit metadata allowlist.** A typed workflow/release envelope accepts known scalar fields
and bounded tags rather than arbitrary nested objects. This prevents accidental prompt or personal
data from becoming report metadata. Arbitrary metadata was rejected because sinks may transmit it.

**Model maturity as deterministic state.** Observation count, elapsed window, and traffic stability
produce a state plus machine-readable reasons. A vague confidence score was rejected because users
could not know how to resolve it.

**Separate audit reports from health events.** Findings describe cost; health events describe the
instrumentation pipeline. Mixing them would make missing reports hard to diagnose and could pollute
cost history. Both use isolated, non-throwing delivery paths.

**Diagnose masks without echoing content.** Track churn rates, stable-prefix or line positions, and
classification counts; never attach suspect substrings. Rich preview diagnostics were rejected
because even local defaults tend to reach centralized logs.

**Keep new behavior opt-in or additive.** Production remains silent without a destination. A required
workflow name is introduced through a new configuration shape with a compatibility adapter and a
documented deprecation path for the old constructor.

## Risks / Trade-offs

- [Required identity adds setup] → Provide terse examples and deterministic identifiers from the
  explicit name, not prompt text.
- [Maturity thresholds fit workloads differently] → Supply conservative defaults and explicit
  overrides in reports.
- [Health events can become noisy] → Deduplicate, rate-limit, and summarize repeated conditions.
- [Diagnostics are less convenient without text] → Prefer privacy; document local debugging hooks as
  explicitly unsafe and never enable them by default.

## Migration Plan

Ship additive report fields and health types first, then introduce workflow identity with a
deprecation window. Accept older report consumers through versioned decoding. Release as a minor
version unless the existing constructor cannot remain valid; if it cannot, defer the required field
to the next major SDK release. Rollback ignores additive fields and restores the previous emission
policy without data migration.
