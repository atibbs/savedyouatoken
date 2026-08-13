## 1. Evidence gates and sequencing

- [ ] 1.1 Confirm Developer Monitor retention and repeated demand before starting expansion work
- [ ] 1.2 Rank team governance, each integration, and each enterprise control by repeated customer evidence
- [ ] 1.3 Define a separate launch gate, owner, support cost, and success measure for every selected capability
- [ ] 1.4 Update the roadmap to keep unselected integrations explicitly deferred

## 2. Workspace foundation

- [ ] 2.1 Introduce workspace tenancy and migrate existing developers into single-member workspaces
- [ ] 2.2 Add workflow ownership and owner-based regression routing
- [ ] 2.3 Define least-privilege viewer, contributor, policy-admin, workspace-admin, and billing roles
- [ ] 2.4 Centralize authorization checks and test the complete subject/action/resource permission matrix
- [ ] 2.5 Add invitation, membership, role-change, suspension, removal, and ownership-transfer workflows

## 3. Governance and auditing

- [ ] 3.1 Implement workspace policy inheritance, precedence, and controlled workflow exceptions
- [ ] 3.2 Add append-only audit events for identity, role, ownership, policy, retention, integration, export, and deletion actions
- [ ] 3.3 Build authorized audit search and export without exposing cross-workspace data
- [ ] 3.4 Add governance documentation and administrative recovery procedures
- [ ] 3.5 Verify cross-tenant isolation, privilege escalation defenses, and immutable audit behavior

## 4. Notification and telemetry integrations

- [ ] 4.1 Define a prompt-free, versioned regression and health event contract for integrations
- [ ] 4.2 Implement the highest-demand Slack or Teams adapter with test, retry, mute, and delivery status
- [ ] 4.3 Implement the second chat adapter only after the first meets its adoption and reliability gate
- [ ] 4.4 Define stable prompt-free OpenTelemetry metrics, events, attributes, and cardinality limits
- [ ] 4.5 Implement optional OpenTelemetry export and verify operation with a standard collector
- [ ] 4.6 Publish integration support matrices, scopes, deprecation periods, and failure isolation

## 5. Language and framework ecosystem

- [ ] 5.1 Publish shared provider fixtures, normalized shapes, canonical reports, and privacy canaries as a conformance suite
- [ ] 5.2 Select the first language or framework adapter using observed customer demand
- [ ] 5.3 Implement the selected adapter with supported-path, streaming, version, and escape-hatch documentation
- [ ] 5.4 Prove request/response non-intrusion and report parity against the TypeScript implementation
- [ ] 5.5 Add compatibility CI and a deprecation policy before declaring the adapter supported
- [ ] 5.6 Repeat adapter work only when the prior integration meets its adoption/support gate

## 6. Enterprise identity and data controls

- [ ] 6.1 Implement the selected SSO and provisioning protocols with workspace role mapping and deprovisioning tests
- [ ] 6.2 Add configurable retention, legal holds where offered, export control, and deletion verification
- [ ] 6.3 Add regional placement and encryption options only for supported deployment topologies
- [ ] 6.4 Implement customer-managed key health, rotation, revocation, and fail-closed recovery if validated by demand
- [ ] 6.5 Add versioned custom model aliases and negotiated pricing catalogues with historical provenance

## 7. Self-hosted productization

- [ ] 7.1 Define the supported topology, resource requirements, license entitlement, and customer/vendor responsibility matrix
- [ ] 7.2 Package signed versioned releases with install, preflight, health, backup, restore, and upgrade tooling
- [ ] 7.3 Preserve hosted contract conformance, tenancy, audit, retention, and deletion behavior in self-hosted deployments
- [ ] 7.4 Pilot installation, upgrade, rollback or forward-fix, backup, and restore with design partners
- [ ] 7.5 Publish supported versions, security-update policy, incident channels, maintenance notice, and support targets

## 8. Verification

- [ ] 8.1 Run typecheck, all tests, all builds, contract conformance, integration matrices, and security checks
- [ ] 8.2 Complete tenant-isolation, RBAC, audit-integrity, provisioning, retention, encryption, and upgrade test suites
- [ ] 8.3 Verify every integration and enterprise service remains optional and every Community path works without it
