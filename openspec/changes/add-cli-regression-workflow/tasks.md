## 1. Automation contracts

- [ ] 1.1 Adopt the versioned report, baseline, and policy contracts in the CLI
- [ ] 1.2 Define stable versioned machine output for discovery, comparison, and policy evaluation
- [ ] 1.3 Define exact, approximate, and invalid comparison display and exit behavior
- [ ] 1.4 Document backward compatibility for existing file arguments, budgets, `--fix`, and JSON consumers

## 2. Repository discovery

- [ ] 2.1 Define explicit discovery configuration, supported asset classes, stable identities, and ignore behavior
- [ ] 2.2 Implement known-file and extension discovery without scanning arbitrary string literals
- [ ] 2.3 Add parser adapters for prompt files, agent instructions, and supported tool/config schema formats
- [ ] 2.4 Report included, excluded, ambiguous, and unsupported candidates with reasons
- [ ] 2.5 Add fixtures for monorepos, ignores, symlinks, binary files, and ambiguous sources

## 3. Baselines and policies

- [ ] 3.1 Implement canonical prompt-free baseline creation with source revision and pricing provenance
- [ ] 3.2 Implement SDK report ingestion with workflow, release, maturity, and compatibility validation
- [ ] 3.3 Implement reviewable policy generation from a mature report or current CLI audit
- [ ] 3.4 Implement deterministic absolute and baseline-relative pass, warn, and fail evaluation
- [ ] 3.5 Implement token, cache, output-assumption, monthly-cost, and finding diffs without overlapping-savings totals

## 4. Pull-request integration

- [ ] 4.1 Define a prompt-free pull-request summary and stable marker format from CLI JSON
- [ ] 4.2 Build a GitHub workflow or action that runs the CLI and updates one idempotent review surface
- [ ] 4.3 Fall back to job summary and exit status when pull-request comment permissions are unavailable
- [ ] 4.4 Add ownership-friendly asset grouping, comparison caveats, and concrete next actions
- [ ] 4.5 Dogfood the integration on this repository using non-sensitive fixtures

## 5. Fix safety and documentation

- [ ] 5.1 Classify findings as lossless auto-fix or advisory review/evaluation work
- [ ] 5.2 Prevent advisory findings from entering automatic rewrite output
- [ ] 5.3 Document discovery, baseline review, SDK handoff, policy refresh, CI, and GitHub permissions

## 6. Verification

- [ ] 6.1 Test deterministic reruns, canonical files, exit codes, schema versions, and compatibility errors
- [ ] 6.2 Add privacy canaries to baselines, policies, machine output, logs, and pull-request feedback
- [ ] 6.3 Test idempotent comment updates and the permissions fallback in a representative CI harness
- [ ] 6.4 Run typecheck, all tests, CLI bundle build, package-content inspection, and end-to-end CI fixtures
