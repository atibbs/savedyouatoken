## 1. Operational contracts

- [x] 1.1 Define bounded workflow identity, environment, service, version, commit, deployment, and tag types
- [x] 1.2 Define deterministic maturity states, thresholds, progress, and machine-readable reason codes
- [x] 1.3 Define prompt-free health-event types and a non-throwing health destination contract
- [x] 1.4 Define comparison provenance fields and compatibility behavior with the shared report contract

## 2. Workflow and release identity

- [x] 2.1 Add workflow configuration and generate a stable identifier without hashing prompt content into it
- [x] 2.2 Attach allowlisted release and environment metadata to every applicable report
- [x] 2.3 Bound tag keys, values, counts, and serialized sizes and reject disallowed metadata safely
- [x] 2.4 Add a compatibility path and deprecation guidance for integrations without workflow identity

## 3. Maturity and diagnostics

- [x] 3.1 Track observation count, elapsed window, and traffic stability independently from shape analysis
- [x] 3.2 Emit provisional progress and a mature transition even when the request shape remains unchanged
- [x] 3.3 Detect excessive shape churn and calculate mask-effectiveness diagnostics without content previews
- [x] 3.4 Deduplicate and rate-limit repeated diagnostic and health conditions

## 4. Health and failure isolation

- [x] 4.1 Emit initialization, capture, unsupported-method, unknown-model, analysis, and sink-delivery health events
- [x] 4.2 Ensure every new event path is deferred and cannot alter request, response, streaming, or caller errors
- [x] 4.3 Preserve production silence when neither audit nor health destinations are configured

## 5. Documentation and verification

- [x] 5.1 Publish production-readiness, supported-method, privacy, masking, maturity, and troubleshooting guidance
- [x] 5.2 Add tests for stable identity, bounded metadata, maturity transitions, and release provenance
- [x] 5.3 Add privacy canaries covering every operational field, diagnostic, health event, and sink
- [x] 5.4 Add failure and timing tests proving health/report delivery never reaches the application path
- [x] 5.5 Run typecheck, all tests, SDK bundle build, declaration inspection, and package-content verification
