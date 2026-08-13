## Why

If the pilot demonstrates repeated operational use and willingness to pay, developers need a hosted
place to retain prompt-free reports, compare deployments, receive regressions, and connect proven
baselines to CI. This is the smallest credible flagship product rather than an SDK sold in isolation.

## What Changes

- Add authenticated prompt-free report ingestion organized by workflow and release.
- Retain history and baselines and provide valid deployment comparisons.
- Detect material regressions and deliver configurable alerts.
- Connect approved baselines and policies to GitHub and the CLI.
- Activate a simple Developer Pro entitlement and predictable subscription only after the pilot gate
  is satisfied.
- Add retention, deletion, export, rate-limit, observability, and failure-handling controls.

## Capabilities

### New Capabilities

- `developer-monitor`: Hosted single-developer workflow history, comparisons, regression alerts,
  integrations, and entitlement management.

### Modified Capabilities

None.

## Impact

Introduces the private control-plane application, Postgres persistence, authentication, Stripe,
background notification processing, and operational monitoring. These are paid or always-on
services, but they are isolated from the Community repository and optional to all free surfaces.
The free analyser remains static, local, account-free, and zero marginal compute cost.
