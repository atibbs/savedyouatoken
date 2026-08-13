## Purpose

Defines supported notification, telemetry, language, and framework integrations while preserving
deterministic analysis, privacy boundaries, and cross-surface report parity.

## ADDED Requirements

### Requirement: Notification integrations
Supported Slack and Teams destinations SHALL expose test, delivery, retry, mute, and failure status
and SHALL receive prompt-free regression summaries only.

#### Scenario: Team tests a destination
- **WHEN** an administrator sends a test notification
- **THEN** the destination receives a clearly labeled non-regression message

### Requirement: OpenTelemetry export
The SDK and Monitor SHALL export documented prompt-free metrics and events through OpenTelemetry
without requiring a proprietary collector.

#### Scenario: Customer configures an existing collector
- **WHEN** telemetry export is enabled
- **THEN** workflow cost and instrumentation-health signals use stable documented attributes
- **AND** no prompt content is exported

### Requirement: Cross-language analysis parity
Official language SDKs SHALL consume the same versioned contracts and SHALL produce equivalent
analysis results or clearly identify when analysis occurs through a different supported boundary.

#### Scenario: TypeScript and Python observe equivalent requests
- **WHEN** model, stable content, tools, workload, and engine version are equivalent
- **THEN** their report findings, counts, and cost figures match

### Requirement: Framework adapter transparency
Each framework adapter SHALL document what it observes, unsupported request paths, streaming
limitations, and escape hatches, and SHALL not alter provider request or response behavior.

#### Scenario: Framework bypasses the supported hook
- **WHEN** the adapter cannot observe a request
- **THEN** it surfaces a health condition rather than claiming successful coverage

### Requirement: Integration compatibility policy
Official integrations SHALL publish supported versions, test matrices, deprecation periods, and
failure isolation behavior.

#### Scenario: Framework releases a breaking version
- **WHEN** compatibility is not yet verified
- **THEN** the adapter reports the version as unverified or unsupported rather than silently
  promising coverage
