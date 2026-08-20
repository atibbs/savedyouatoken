## Why

SDK reports are difficult to consume without custom callbacks or log processing, and proving an
optimization currently requires a manual before/after workflow. A local workbench creates immediate
post-install value and tests the recurring Monitor workflow without requiring hosted infrastructure.

## What Changes

- Add a local prompt-free report store and viewer for workflows, releases, maturity, and findings.
- Compare two compatible reports and attribute token and cost changes without summing overlapping
  findings.
- Highlight insufficient maturity, incompatible comparisons, and unknown prices explicitly.
- Export a selected mature baseline into the shared CLI policy format.
- Provide a simple SDK sink and CLI command to launch or populate the workbench.

## Capabilities

### New Capabilities

- `local-monitoring-workbench`: Local report history, before/after comparisons, baseline selection,
  and policy export without an account or hosted service.

### Modified Capabilities

None.

## Impact

Introduces a local development application or CLI-served viewer plus adapters in the SDK and CLI.
Stored data remains prompt-free and local. The hosted web analyser remains static and zero-cost;
there is no paid service or always-on infrastructure, and any local server runs only on explicit
user invocation.
