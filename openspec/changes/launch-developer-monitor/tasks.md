## 1. Launch gates and private service boundary

- [ ] 1.1 Confirm the Monitor pilot recorded a proceed decision against its predeclared thresholds
- [ ] 1.2 Confirm Community source separation and versioned report/policy contracts are complete
- [ ] 1.3 Establish the private control-plane workspace, environments, least-privilege secrets, and deployment protections
- [ ] 1.4 Define initial Developer limits, retention, grace states, support boundary, and subscription price

## 2. Tenant-safe data model

- [ ] 2.1 Model accounts, workflows, immutable reports, baselines, policies, regressions, destinations, and audit events
- [ ] 2.2 Put explicit account ownership on every tenant resource and centralize scoped query helpers
- [ ] 2.3 Add idempotency and content-identity constraints for report, billing-event, and notification processing
- [ ] 2.4 Add retention, deletion, export, and backup/restore jobs with observable outcomes
- [ ] 2.5 Test migrations, rollback or forward-fix procedures, and cross-tenant denial for every resource type

## 3. Secure report ingestion

- [ ] 3.1 Add scoped ingestion credentials with create, rotate, revoke, and last-used behavior
- [ ] 3.2 Validate authentication, contract version, prompt-free schema, size, rate, and content identity before persistence
- [ ] 3.3 Store immutable source envelopes and enqueue derived comparison work asynchronously
- [ ] 3.4 Return idempotent acknowledgements without making SDK provider calls depend on processing completion
- [ ] 3.5 Add ingestion health, abuse limits, structured errors, and privacy canaries

## 4. History, baselines, and comparisons

- [ ] 4.1 Build workflow, environment, release, maturity, and observation-window history
- [ ] 4.2 Add explicit baseline selection and replacement with audit events
- [ ] 4.3 Reuse shared compatibility rules and comparison arithmetic for exact, approximate, and invalid results
- [ ] 4.4 Display token, workload, cache, cost, and finding changes with pricing provenance and quality caveats
- [ ] 4.5 Export canonical baselines and policies for CLI use

## 5. Regression and alerts

- [ ] 5.1 Evaluate each new mature report against its active baseline and policy idempotently
- [ ] 5.2 Create one regression event per workflow, release, baseline, and breached policy state
- [ ] 5.3 Implement an outbox worker with retries, backoff, dead-letter visibility, and delivery audit
- [ ] 5.4 Add one initial alert destination with create, test, mute, disable, and failure status
- [ ] 5.5 Link prompt-free GitHub or CLI results to matching workflow and release identities

## 6. Entitlement and billing

- [ ] 6.1 Configure the Developer product and predictable subscription outside the codebase
- [ ] 6.2 Activate checkout, verified idempotent webhook, database entitlement, portal, cancellation, and recovery flows
- [ ] 6.3 Enforce paid limits from persisted entitlement state while preserving export and deletion access
- [ ] 6.4 Add a documented payment-failure grace state that does not immediately destroy retained evidence
- [ ] 6.5 Verify no Community path requires auth, database, Stripe, worker, or Monitor availability

## 7. Operations and launch verification

- [ ] 7.1 Add service health, ingestion latency, queue depth, alert delivery, error, backup, and deletion monitoring
- [ ] 7.2 Publish privacy, retention, deletion, security, status, support, pricing, and availability documentation
- [ ] 7.3 Shadow-ingest consenting pilot reports and verify comparison parity with the local workbench
- [ ] 7.4 Exercise outage, retry, duplicate, cross-tenant, webhook replay, deletion, restore, and grace-state runbooks
- [ ] 7.5 Run typecheck, all tests, service and client builds, security checks, migration tests, and end-to-end staging verification
