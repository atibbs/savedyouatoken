## Purpose

Defines an account-free local workbench for retaining prompt-free reports, understanding measurement
maturity, proving before-and-after savings, and exporting validated CI baselines.

## ADDED Requirements

### Requirement: Local report ingestion
The workbench SHALL accept supported versioned reports from files, the CLI, or an explicitly
configured local SDK sink and SHALL reject invalid or unsupported reports with actionable errors.

#### Scenario: SDK emits to the local workbench
- **WHEN** the workbench is running and the caller opts into its local sink
- **THEN** the valid prompt-free report appears under its workflow and release

### Requirement: Workflow history
The workbench SHALL organize reports by workflow, environment, release, observation time, and
maturity while preserving each immutable source report.

#### Scenario: Workflow has multiple deployments
- **WHEN** an operator opens its history
- **THEN** they can distinguish reports by release and maturity without reading hashes alone

### Requirement: Compatibility-aware comparison
The workbench SHALL compare compatible reports, label approximate comparisons, reject invalid ones,
and show token, workload, cache, monthly-cost, and finding changes without summing overlapping
finding savings.

#### Scenario: Operator compares before and after
- **WHEN** two mature reports share compatible analysis assumptions
- **THEN** the workbench shows the measured delta and its pricing context

### Requirement: Maturity guidance
The workbench SHALL distinguish provisional from mature evidence and explain missing thresholds or
observation conditions before a report can be selected as a trusted baseline.

#### Scenario: User selects a provisional report
- **WHEN** they attempt to approve it as a baseline
- **THEN** the workbench warns that its workload estimate is provisional
- **AND** requires explicit acknowledgement or a mature replacement

### Requirement: Policy export
The workbench SHALL export a selected compatible baseline and user-defined tolerances as a canonical
shared policy document consumable by the CLI.

#### Scenario: Optimization is accepted
- **WHEN** the operator approves the mature post-change report and sets a regression tolerance
- **THEN** a prompt-free policy file is generated for repository use

### Requirement: Local privacy boundary
The workbench SHALL persist only prompt-free contract data by default and SHALL perform no network
transmission unless the user separately configures an integration.

#### Scenario: Workbench runs offline
- **WHEN** network access is unavailable
- **THEN** report ingestion, history, comparison, and policy export remain functional

### Requirement: Explicit lifecycle and portability
The workbench SHALL start only on explicit invocation, bind to loopback by default, expose its local
data location, and support export and deletion of all stored reports.

#### Scenario: User removes local history
- **WHEN** they request deletion and confirm the target store
- **THEN** all workbench report data is removed without changing source policy files
