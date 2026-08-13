## Why

The SDK, CLI, local tools, and future Monitor need to exchange reports, baselines, and enforcement
policies without manual translation. A stable versioned contract is foundational to comparisons,
CI handoff, open-source integrations, and hosted ingestion.

## What Changes

- Define versioned, prompt-free report envelopes with workflow, release, provenance, maturity, and
  analysis metadata.
- Define portable policy documents for token, cost, and regression budgets.
- Add parsing, validation, compatibility, migration, and canonical serialization APIs.
- Publish JSON Schemas and representative fixtures for third-party integrations.
- Define forward-compatibility and deprecation rules before consumers proliferate.

## Capabilities

### New Capabilities

- `report-policy-contracts`: Versioned interchange contracts for audit reports, baselines, and
  enforcement policies shared by Community and Monitor surfaces.

### Modified Capabilities

None.

## Impact

Primarily `packages/core`, with adapters in `packages/sdk` and `packages/cli`, public schemas,
fixtures, and documentation. Core remains dependency-free. The free-tier static/zero-cost invariant
is unchanged; there is no runtime service, paid dependency, or always-on infrastructure.
