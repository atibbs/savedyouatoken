## Purpose

Defines the smallest hosted flagship for individual developers: prompt-free workflow history,
deployment comparisons, regression alerts, CI handoff, and transparent subscription control.

## ADDED Requirements

### Requirement: Authenticated prompt-free ingestion
Monitor SHALL accept only authenticated, schema-valid, prompt-free reports within configured size
and rate limits and SHALL reject arbitrary captured content.

#### Scenario: Report contains a prompt canary
- **WHEN** ingestion detects disallowed content or an invalid contract
- **THEN** the report is rejected and is not persisted

### Requirement: Workflow and release history
Monitor SHALL organize immutable reports by account, workflow, environment, release, observation
window, and maturity and SHALL permit an operator to select a trusted baseline.

#### Scenario: Developer opens a workflow
- **WHEN** reports exist across multiple releases
- **THEN** the developer can identify the current mature report, baseline, and intervening history

### Requirement: Valid deployment comparisons
Monitor SHALL compare compatible reports using shared contract rules, identify approximate or invalid
comparisons, and explain token, workload, cache, cost, and finding changes.

#### Scenario: Catalogue assumptions changed
- **WHEN** two reports use comparison assumptions that prevent an exact priced diff
- **THEN** Monitor labels or rejects the comparison rather than presenting false precision

### Requirement: Material regression detection
Monitor SHALL evaluate new mature reports against the active baseline and policy, deduplicate repeated
events, and create a regression only when a configured threshold is crossed.

#### Scenario: Repeated report describes the same breached release
- **WHEN** it is ingested more than once
- **THEN** Monitor maintains one regression event rather than sending duplicate alerts

### Requirement: Configurable alert delivery
Developers SHALL be able to enable, test, mute, and disable supported alert destinations and SHALL be
told when delivery fails.

#### Scenario: Alert destination rejects delivery
- **WHEN** a regression notification cannot be delivered
- **THEN** the regression remains visible in Monitor
- **AND** the developer can see the delivery failure

### Requirement: CLI and GitHub handoff
Monitor SHALL export canonical baselines or policies and SHALL link a pull-request result to the
matching workflow and release without requiring prompt content.

#### Scenario: Developer approves a production baseline
- **WHEN** they request CI enforcement
- **THEN** Monitor produces a versioned policy consumable by the CLI

### Requirement: Transparent entitlement lifecycle
Paid capabilities SHALL be granted only from persisted entitlement state written by verified billing
events, and users SHALL be able to view subscription state and reach checkout, portal, or recovery
actions without losing retained data immediately after payment failure.

#### Scenario: Billing webhook is replayed
- **WHEN** a previously processed valid event arrives again
- **THEN** entitlement state remains correct and no duplicate side effect occurs

### Requirement: User-controlled data lifecycle
Developers SHALL be able to export and delete workflows or their account, SHALL see configured
retention, and SHALL receive confirmation of completed deletion.

#### Scenario: Developer deletes a workflow
- **WHEN** deletion is confirmed
- **THEN** its reports, baselines, regressions, and derived records become inaccessible and are
  removed according to the stated deletion window

### Requirement: Tenant isolation and operational reliability
Every stored and served resource SHALL be scoped to its owner, sensitive operations SHALL be audited,
and ingestion or alert failures SHALL NOT affect instrumented provider requests.

#### Scenario: Authenticated user requests another account's report identifier
- **WHEN** ownership does not match
- **THEN** no report data or existence information is disclosed
