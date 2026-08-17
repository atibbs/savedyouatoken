## 1. Automation contracts

- [x] 1.1 Adopt the versioned report, baseline, and policy contracts in the CLI
- [x] 1.2 Define stable versioned machine output for discovery, comparison, and policy evaluation
- [x] 1.3 Define exact, approximate, and invalid comparison display and exit behavior
- [x] 1.4 Document backward compatibility for existing file arguments, budgets, `--fix`, and JSON consumers

## 2. Repository discovery

- [x] 2.1 Define explicit discovery configuration, supported asset classes, stable identities, and ignore behavior
- [x] 2.2 Implement known-file and extension discovery without scanning arbitrary string literals
- [x] 2.3 Add parser adapters for prompt files, agent instructions, and supported tool/config schema formats
- [x] 2.4 Report included, excluded, ambiguous, and unsupported candidates with reasons
- [x] 2.5 Add fixtures for monorepos, ignores, symlinks, binary files, and ambiguous sources

## 3. Baselines and policies

- [x] 3.1 Implement canonical prompt-free baseline creation with source revision and pricing provenance
- [x] 3.2 Implement SDK report ingestion with workflow, release, maturity, and compatibility validation
- [x] 3.3 Implement reviewable policy generation from a mature report or current CLI audit
- [x] 3.4 Implement deterministic absolute and baseline-relative pass, warn, and fail evaluation
- [x] 3.5 Implement token, cache, output-assumption, monthly-cost, and finding diffs without overlapping-savings totals

## 4. Pull-request integration

- [x] 4.1 Define a prompt-free pull-request summary and stable marker format from CLI JSON
- [x] 4.2 Build a GitHub workflow or action that runs the CLI and updates one idempotent review surface
- [x] 4.3 Fall back to job summary and exit status when pull-request comment permissions are unavailable
- [x] 4.4 Add ownership-friendly asset grouping, comparison caveats, and concrete next actions
- [x] 4.5 Dogfood the integration on this repository using non-sensitive fixtures

## 5. Fix safety and documentation

- [x] 5.1 Classify findings as lossless auto-fix or advisory review/evaluation work
- [x] 5.2 Prevent advisory findings from entering automatic rewrite output
- [x] 5.3 Document discovery, baseline review, SDK handoff, policy refresh, CI, and GitHub permissions

## 6. Verification

- [x] 6.1 Test deterministic reruns, canonical files, exit codes, schema versions, and compatibility errors
- [x] 6.2 Add privacy canaries to baselines, policies, machine output, logs, and pull-request feedback
- [x] 6.3 Test idempotent comment updates and the permissions fallback in a representative CI harness
- [x] 6.4 Run typecheck, all tests, CLI bundle build, package-content inspection, and end-to-end CI fixtures
