## Purpose

Defines production-operability signals for the runtime SDK so teams can identify monitored
workflows, judge data maturity, diagnose instrumentation safely, and compare reports confidently.

## ADDED Requirements

### Requirement: Stable workflow identity
The SDK SHALL accept a required human-readable workflow name and SHALL assign a stable workflow
identifier to every emitted report without deriving that identity from prompt content.

#### Scenario: Operator names an instrumentation point
- **WHEN** an auditor is configured with a workflow name
- **THEN** every report carries that name and a stable prompt-independent workflow identifier

### Requirement: Release and environment metadata
The SDK SHALL allow callers to attach environment, service, version, commit, and deployment metadata
and SHALL omit unset values without inventing them.

#### Scenario: Deployment metadata is configured
- **WHEN** a request is observed after a deployment identity is supplied
- **THEN** the emitted report contains the supplied identity for later comparison

### Requirement: Observable measurement maturity
The SDK SHALL classify workload estimates as provisional or mature, expose progress toward maturity,
and explain which observation thresholds remain unmet.

#### Scenario: A new workflow has sparse traffic
- **WHEN** insufficient observations or elapsed time exist for a mature estimate
- **THEN** the report is marked provisional
- **AND** the operator can see why it is not mature

#### Scenario: A workflow reaches maturity
- **WHEN** all configured maturity thresholds are satisfied
- **THEN** a mature report is emitted even if the prompt shape itself did not change

### Requirement: Instrumentation health signals
The SDK SHALL surface initialization, capture, analysis, sink-delivery, unsupported-method, and
unknown-model conditions through a configurable health destination without throwing them into the
application request path.

#### Scenario: Sink delivery fails
- **WHEN** a configured audit sink rejects a report
- **THEN** the application response remains unaffected
- **AND** the failure is made observable through the health destination

### Requirement: Prompt-safe masking diagnostics
The SDK SHALL report shape churn, mask effectiveness, and suspected unmasked variable regions using
counts, hashes, positions, or classifications that do not reveal prompt or tool text.

#### Scenario: Variable content creates excessive shapes
- **WHEN** one workflow produces shape churn above the configured threshold
- **THEN** the operator receives a prompt-free diagnostic recommending mask review

### Requirement: Comparison-ready report metadata
Each emitted report SHALL include timestamps, analysis-engine version, catalogue verification date,
contract version, and observation-window bounds sufficient to determine comparison compatibility.

#### Scenario: Two reports use incompatible analysis versions
- **WHEN** a consumer evaluates them for comparison
- **THEN** the metadata is sufficient to detect and explain the incompatibility

### Requirement: Privacy-preserving compatibility
Operational metadata and health signals SHALL remain prompt-free, existing default production
silence SHALL be preserved, and additive configuration SHALL not change captured requests or provider
responses.

#### Scenario: Existing production integration does not opt in
- **WHEN** an existing caller upgrades without configuring a report or health destination
- **THEN** no network output is introduced
- **AND** provider request and response behavior remains unchanged
