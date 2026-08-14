## Context

Core has a prompt-free share-report codec, while the SDK, CLI, local viewer, and future hosted system
need a broader interchange envelope. Contract code must remain deterministic and keep core
dependency-free. Reports can outlive catalogue and engine versions, so comparison context cannot be
implicit.

## Goals / Non-Goals

**Goals:**

- Establish one public contract before multiple consumers invent incompatible formats.
- Make privacy, compatibility, and deterministic identity testable at the byte boundary.
- Separate observed facts from evaluation policy.

**Non-Goals:**

- Guarantee that reports from materially different engines are comparable.
- Embed prompt text for later re-analysis.
- Define hosted storage or transport protocols.

## Decisions

**Place TypeScript contracts and validators in core, publish JSON Schemas as artifacts.** Handwritten,
dependency-free runtime guards keep all existing surfaces usable while JSON Schema supports other
languages. Adding a schema-validation runtime dependency to core was rejected.

**Use major/minor integer versions and explicit discriminators.** Major versions represent breaking
meaning; additive optional fields stay within a major line. Semver tied to the npm package was
rejected because contract lifetime and package release cadence differ.

**Separate reports, baselines, and policies.** A baseline references an immutable report identity;
policy expresses evaluation thresholds. Combining thresholds into reports was rejected because the
same evidence may be evaluated under different environments or risk tolerances.

**Canonicalize with sorted object keys and normalized numeric/string forms.** Content identifiers are
computed only after validation and canonicalization. Raw JSON hashing was rejected because key order
would make identity producer-specific.

**Carry comparison provenance explicitly.** Engine version, ruleset identity, model catalogue date,
currency, and workload window allow consumers to declare comparisons valid, approximate, or invalid
instead of silently mixing assumptions.

## Risks / Trade-offs

- [Contract becomes a dumping ground] → Require every field to support interoperability or audit;
  keep UI state elsewhere.
- [Schema and handwritten validators drift] → Generate both from one checked definition or enforce
  fixture parity in CI.
- [Canonicalization mistakes become permanent] → Publish test vectors before depending on hashes.
- [Strict validation rejects useful old data] → Maintain deterministic migrations for a documented
  window and surface unsupported versions explicitly.

## Migration Plan

Introduce the new envelope alongside the existing share report and write adapters in each producer.
Publish fixtures and validate dual-written output before switching consumers. Keep the share-link
codec stable until its URLs have a documented migration path. Rollback leaves the new fields unused
and retains existing product-specific formats.
