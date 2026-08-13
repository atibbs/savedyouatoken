## Why

The SDK can capture production truth, but operators still struggle to identify workflows, judge
measurement maturity, diagnose masking, and know whether instrumentation is healthy. These gaps
make a successful installation appear silent or unreliable and prevent teams from acting on its
reports confidently.

## What Changes

- Add human-readable workflow identity and optional release/deployment metadata to SDK reports.
- Surface provisional-to-mature measurement progress and explicit instrumentation health events.
- Add safe masking diagnostics that explain shape churn without revealing prompt content.
- Document production readiness, wrapper behavior, failure isolation, privacy boundaries, and
  supported provider methods.
- Add comparison-friendly report metadata while preserving deterministic analysis and prompt-free
  off-process payloads.

## Capabilities

### New Capabilities

- `sdk-operations`: Operational identity, maturity, diagnostics, and health behavior for production
  SDK instrumentation.

### Modified Capabilities

None.

## Impact

Changes affect `packages/sdk`, its report types and sinks, tests, and SDK documentation. The free web
path remains static and zero-cost. No new paid service or always-on infrastructure is introduced;
the SDK retains its existing runtime dependency profile and production no-op defaults.
