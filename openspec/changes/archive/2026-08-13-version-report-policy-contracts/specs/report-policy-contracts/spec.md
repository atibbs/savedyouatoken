## Purpose

Defines portable, versioned, prompt-free contracts that let savedyouatoken surfaces and third-party
tools exchange audit reports, baselines, comparisons, and enforcement policies safely.

## ADDED Requirements

### Requirement: Versioned report envelope
Every portable report SHALL declare a contract version and contain analysis results, workflow and
release identity, provenance, maturity, observation-window, and analysis-catalogue metadata using a
published schema.

#### Scenario: Consumer receives a supported report
- **WHEN** a report declares a supported contract version and validates against its schema
- **THEN** the consumer can parse it without product-specific translation

### Requirement: Prompt-free serialization
Portable reports SHALL contain no prompt text, tool names, tool descriptions, schemas, arbitrary
captured request content, or content-derived finding detail.

#### Scenario: Canary data is analysed
- **WHEN** unique canaries appear in every captured content field and the report is serialized
- **THEN** none of those canaries appear anywhere in the serialized bytes

### Requirement: Explicit validation failures
Parsers SHALL reject malformed, unsupported, or semantically invalid documents with structured error
codes and locations rather than partially accepting them.

#### Scenario: Required currency metadata is missing
- **WHEN** a consumer parses a report that lacks a required field
- **THEN** parsing fails with a machine-readable validation location

### Requirement: Controlled forward compatibility
Consumers SHALL ignore unknown optional fields, SHALL reject unknown major contract versions, and
SHALL preserve a documented compatibility window for supported versions.

#### Scenario: New optional field reaches an older consumer
- **WHEN** a supported-version report contains an unrecognized optional field
- **THEN** the older consumer processes all recognized fields successfully

### Requirement: Portable policy document
A policy SHALL identify its schema version, target scope, optional baseline identity, token and cost
budgets, regression tolerances, pricing assumptions, and enforcement severity.

#### Scenario: CLI evaluates a baseline-relative policy
- **WHEN** the current audit and referenced baseline are compatible
- **THEN** the policy produces deterministic pass, warn, or fail outcomes

### Requirement: Canonical serialization and identity
Contracts SHALL define canonical serialization and content identity so equivalent reports or policies
produce the same identifier across SDK, CLI, local, and hosted consumers.

#### Scenario: Two consumers serialize equivalent data
- **WHEN** they serialize semantically identical supported documents
- **THEN** the canonical bytes and content identifier are equal

### Requirement: Migration support
The contract package SHALL provide deterministic migration for every supported older version and
SHALL retain original version and provenance metadata after migration.

#### Scenario: Older report is upgraded
- **WHEN** a supported older report is read by a current consumer
- **THEN** it is migrated to the current in-memory form
- **AND** its source contract version remains available for audit
