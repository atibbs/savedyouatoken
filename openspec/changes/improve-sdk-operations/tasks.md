## 1. Operational contracts

- [ ] 1.1 Define bounded workflow identity, environment, service, version, commit, deployment, and tag types
- [ ] 1.2 Define deterministic maturity states, thresholds, progress, and machine-readable reason codes
- [ ] 1.3 Define prompt-free health-event types and a non-throwing health destination contract
- [ ] 1.4 Define comparison provenance fields and compatibility behavior with the shared report contract

## 2. Workflow and release identity

- [ ] 2.1 Add workflow configuration and generate a stable identifier without hashing prompt content into it
- [ ] 2.2 Attach allowlisted release and environment metadata to every applicable report
- [ ] 2.3 Bound tag keys, values, counts, and serialized sizes and reject disallowed metadata safely
- [ ] 2.4 Add a compatibility path and deprecation guidance for integrations without workflow identity

## 3. Maturity and diagnostics

- [ ] 3.1 Track observation count, elapsed window, and traffic stability independently from shape analysis
- [ ] 3.2 Emit provisional progress and a mature transition even when the request shape remains unchanged
- [ ] 3.3 Detect excessive shape churn and calculate mask-effectiveness diagnostics without content previews
- [ ] 3.4 Deduplicate and rate-limit repeated diagnostic and health conditions

## 4. Health and failure isolation

- [ ] 4.1 Emit initialization, capture, unsupported-method, unknown-model, analysis, and sink-delivery health events
- [ ] 4.2 Ensure every new event path is deferred and cannot alter request, response, streaming, or caller errors
- [ ] 4.3 Preserve production silence when neither audit nor health destinations are configured

## 5. Documentation and verification

- [ ] 5.1 Publish production-readiness, supported-method, privacy, masking, maturity, and troubleshooting guidance
- [ ] 5.2 Add tests for stable identity, bounded metadata, maturity transitions, and release provenance
- [ ] 5.3 Add privacy canaries covering every operational field, diagnostic, health event, and sink
- [ ] 5.4 Add failure and timing tests proving health/report delivery never reaches the application path
- [ ] 5.5 Run typecheck, all tests, SDK bundle build, declaration inspection, and package-content verification
