## Why

The CLI can fail a budget today, but teams still need to discover prompt assets, establish trusted
baselines, understand priced changes in pull requests, and carry production findings back into CI.
Closing that loop turns a one-time audit into a durable pre-deployment guardrail.

## What Changes

- Scan repositories for supported prompt, instruction, tool-schema, and configuration assets.
- Ingest versioned SDK reports and generate reviewable baseline and policy files.
- Compare the current result with a committed baseline and report token and monthly-cost deltas.
- Produce stable machine-readable output and GitHub pull-request comments with ownership-friendly
  summaries.
- Distinguish safe mechanical fixes from judgment-heavy recommendations and preserve explicit
  budget exit behavior.

## Capabilities

### New Capabilities

- `cli-regression-workflow`: Repository discovery, baselines, priced diffs, SDK handoff, policy
  enforcement, and pull-request feedback for the CLI.

### Modified Capabilities

None.

## Impact

Changes affect `packages/cli`, shared contracts from `packages/core`, a GitHub Action or documented
workflow, fixtures, and CI documentation. The analyser remains deterministic and local. The free
static web path is unchanged, and no paid service or always-on infrastructure is required; GitHub
integration runs only in the customer's CI environment.
