## Purpose

Defines enterprise controls for identity, data governance, networking, pricing customization,
self-hosted deployment, and support without changing Community analysis behavior.

## ADDED Requirements

### Requirement: Enterprise identity lifecycle
Enterprise deployments SHALL support centralized sign-on and automated user provisioning with
workspace-scoped role mapping and timely deprovisioning.

#### Scenario: User is removed from the identity provider
- **WHEN** a valid deprovisioning event is processed
- **THEN** their workspace access is revoked within the documented interval

### Requirement: Configurable data governance
Organizations SHALL configure report retention, deletion holds, export controls, regional placement
where offered, and encryption options, and SHALL be able to verify effective settings.

#### Scenario: Retention period expires
- **WHEN** a report is not subject to a valid hold
- **THEN** it and its derived data are deleted within the documented window

### Requirement: Private connectivity and key control
Where contracted, the service SHALL support documented private-network paths and customer-managed
encryption keys with observable key-health and revocation behavior.

#### Scenario: Customer key becomes unavailable
- **WHEN** protected data cannot be decrypted
- **THEN** access fails closed and the condition is surfaced without exposing data

### Requirement: Custom catalogues and prices
Authorized organizations SHALL define versioned model aliases and negotiated prices, and every
report or comparison SHALL identify the catalogue version used.

#### Scenario: Negotiated rate changes
- **WHEN** a new catalogue version becomes active
- **THEN** new reports use it while historical results retain their original pricing provenance

### Requirement: Self-hosted functional boundary
The supported self-hosted edition SHALL document required components, upgrades, backups, telemetry,
license entitlements, and responsibility boundaries and SHALL preserve the same report and policy
contracts as the hosted service.

#### Scenario: Customer upgrades a supported self-hosted release
- **WHEN** documented preflight checks pass
- **THEN** stored reports and policies migrate without losing provenance or tenant boundaries

### Requirement: Verifiable support commitments
Enterprise service commitments SHALL define supported versions, incident channels, response targets,
maintenance notice, security updates, and exclusions without implying guarantees for Community use.

#### Scenario: Customer reports a covered incident
- **WHEN** it arrives through the contracted channel
- **THEN** acknowledgement and escalation follow the documented commitment
