# cli-regression-workflow Specification

## Purpose
Defines a repository-to-pull-request workflow that discovers analyzable assets, establishes trusted
baselines, prices changes, imports runtime evidence, and enforces deterministic cost policies.

## Requirements

### Requirement: Repository asset discovery
The CLI SHALL scan configured repository paths for supported prompt, agent instruction, tool schema,
and configuration assets, SHALL honor ignore rules, and SHALL report why each candidate was included,
excluded, or unsupported.

#### Scenario: Repository contains mixed files
- **WHEN** a user runs repository scanning
- **THEN** supported assets are listed with stable identities
- **AND** ignored or ambiguous candidates are not silently audited

### Requirement: Immutable baseline creation
The CLI SHALL create a canonical prompt-free baseline from successful audit reports and SHALL record
the source revision, contract version, pricing assumptions, and asset identity.

#### Scenario: User accepts the current audit
- **WHEN** they create a baseline from a valid report
- **THEN** the resulting file can be committed and reproduced without containing prompt text

### Requirement: Priced regression comparison
The CLI SHALL compare current and baseline results and report input-token, output-assumption, cache,
monthly-cost, and finding changes while identifying incompatible or approximate comparisons.

#### Scenario: A prompt grows after the baseline
- **WHEN** the current result is compatible with the baseline
- **THEN** the CLI reports the exact token delta and priced workload delta

### Requirement: SDK report handoff
The CLI SHALL ingest supported versioned SDK reports, preserve workflow and release provenance, and
allow a mature report to seed a repository policy without requiring raw captured content.

#### Scenario: Production report becomes a CI budget
- **WHEN** a user imports a mature compatible SDK report
- **THEN** the CLI can generate a reviewable policy referencing that evidence

### Requirement: Deterministic policy enforcement
The CLI SHALL evaluate token, cost, and regression tolerances deterministically and SHALL produce
documented pass, warn, or fail exit behavior suitable for CI.

#### Scenario: Required budget is breached
- **WHEN** a result exceeds a policy threshold with fail severity
- **THEN** the CLI exits non-zero and identifies the breached threshold

### Requirement: Pull-request feedback
The workflow SHALL produce idempotent GitHub pull-request feedback summarizing material asset changes,
priced deltas, policy outcomes, comparison caveats, and next actions without exposing prompt text.

#### Scenario: CI reruns on the same commit
- **WHEN** the integration posts updated feedback
- **THEN** it updates its existing review surface rather than creating duplicate comments

### Requirement: Fix risk classification
CLI findings and fix output SHALL distinguish lossless mechanical rewrites from advisory changes that
require evaluation or human judgment.

#### Scenario: Suggestion may affect behavior
- **WHEN** a finding cannot be fixed with guaranteed semantic preservation
- **THEN** the CLI does not apply it automatically
- **AND** labels it as requiring review or evaluation

### Requirement: Stable automation output
Machine-readable CLI output SHALL declare its schema version and remain separate from human display
formatting.

#### Scenario: Human output wording changes
- **WHEN** a compatible CLI release changes terminal presentation
- **THEN** documented machine consumers continue to receive the same contract behavior
