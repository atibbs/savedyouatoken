## 1. Local data boundary

- [ ] 1.1 Adopt versioned report, baseline, comparison, and policy contracts
- [ ] 1.2 Define the local data directory, immutable source-document layout, disposable index, and migrations
- [ ] 1.3 Implement strict prompt-free validation, size limits, and unsupported-version errors before persistence
- [ ] 1.4 Implement complete report-store export and confirmed deletion

## 2. On-demand local service

- [ ] 2.1 Add a CLI command that starts the workbench explicitly and binds to loopback by default
- [ ] 2.2 Generate an ephemeral ingestion credential and enforce origin and authorization checks
- [ ] 2.3 Add file import and a local SDK sink with bounded retries and visible delivery health
- [ ] 2.4 Expose startup URL, data location, shutdown behavior, and port-conflict recovery

## 3. History and maturity experience

- [ ] 3.1 Build workflow and environment navigation using human labels rather than hashes alone
- [ ] 3.2 Build release history with report time, observation window, maturity, and provenance
- [ ] 3.3 Explain provisional thresholds, unknown models, stale catalogues, and incomplete workload evidence
- [ ] 3.4 Preserve immutable source reports while rebuilding derived indexes and views safely

## 4. Comparison and policy handoff

- [ ] 4.1 Implement shared exact, approximate, and invalid compatibility classification in the viewer
- [ ] 4.2 Display token, workload, cache, monthly-cost, and finding deltas without overlapping-savings totals
- [ ] 4.3 Add explicit baseline approval with maturity warnings and evaluation reminder
- [ ] 4.4 Export the approved baseline and tolerances as a canonical CLI policy

## 5. Documentation and verification

- [ ] 5.1 Document file import, SDK connection, local security boundary, backups, upgrades, export, and deletion
- [ ] 5.2 Test offline operation, loopback-only defaults, authorization, malformed input, and clean shutdown
- [ ] 5.3 Add privacy canaries covering stored documents, indexes, UI output, logs, and exported policies
- [ ] 5.4 Test comparison parity and policy round trips against the CLI
- [ ] 5.5 Run typecheck, all tests, CLI/workbench builds, dependency audit, and local end-to-end smoke tests
