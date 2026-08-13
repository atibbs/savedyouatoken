## 1. Contract definition

- [ ] 1.1 Inventory existing share-report, SDK report, CLI JSON, workload, finding, and budget shapes
- [ ] 1.2 Define contract version semantics and the supported-version/deprecation policy
- [ ] 1.3 Define the report envelope with workflow, release, provenance, maturity, window, and catalogue metadata
- [ ] 1.4 Define immutable baseline references and portable token, cost, regression, and severity policies
- [ ] 1.5 Define structured validation and compatibility error codes and locations

## 2. Dependency-free implementation

- [ ] 2.1 Implement TypeScript contract types and dependency-free runtime validators in `packages/core`
- [ ] 2.2 Implement canonical serialization with normalized keys, strings, and numeric representations
- [ ] 2.3 Implement deterministic content identities for reports, baselines, and policies
- [ ] 2.4 Implement compatibility classification for exact, approximate, and invalid comparisons
- [ ] 2.5 Implement deterministic migrations for every declared supported older version

## 3. Schemas and conformance

- [ ] 3.1 Publish JSON Schemas generated from or checked against the authoritative contract definitions
- [ ] 3.2 Add valid, invalid, forward-compatible, and migration fixtures for each contract type
- [ ] 3.3 Publish canonical byte and content-identity test vectors for non-TypeScript consumers
- [ ] 3.4 Add privacy canaries across prompt, tool name, description, schema, and content-derived finding detail

## 4. Producer and consumer adoption

- [ ] 4.1 Add SDK adapters that emit the versioned report envelope without breaking existing sinks
- [ ] 4.2 Add CLI parsing and output adapters while preserving documented current automation behavior
- [ ] 4.3 Document the contract lifecycle, compatibility rules, privacy boundary, and integration examples
- [ ] 4.4 Define the legacy share-link codec migration boundary without invalidating existing links

## 5. Verification

- [ ] 5.1 Test canonical parity, unknown optional fields, unknown major versions, and structured failures
- [ ] 5.2 Test every supported migration retains source version and provenance
- [ ] 5.3 Run typecheck, all tests, package builds, JSON Schema fixture validation, and public API inspection
