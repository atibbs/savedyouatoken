## Purpose

Defines a small, privacy-bounded production pilot and evidence standard for deciding whether repeated
cost monitoring and regression control justify building and selling savedyouatoken Monitor.

## ADDED Requirements

### Requirement: Qualified pilot cohort
The pilot SHALL enroll three to five teams operating recurring production LLM workflows with an
identified technical owner, measurable release cadence, and willingness to complete follow-up.

#### Scenario: Candidate lacks production traffic
- **WHEN** a candidate cannot reach a meaningful measurement window
- **THEN** they are not counted toward the validation cohort

### Requirement: Explicit data boundary and consent
Participants SHALL receive and accept a written description of collected prompt-free fields,
retention, access, deletion, temporary tooling, communication cadence, and excluded raw content
before transmitting reports.

#### Scenario: Participant has not accepted the boundary
- **WHEN** onboarding reaches report collection
- **THEN** no report is ingested until acceptance is recorded

### Requirement: Complete validation journey
Each participant SHALL be offered workflow labeling, maturity guidance, retained prompt-free reports,
before/after comparison, one material regression notification, a weekly cost summary, and CI-policy
handoff.

#### Scenario: Participant changes an instrumented workflow
- **WHEN** compatible evidence exists before and after the release
- **THEN** the pilot delivers a priced comparison and offers a policy based on the accepted result

### Requirement: Journey evidence
The pilot SHALL record whether installation succeeded, measurement matured, a finding was acted on,
quality was checked, comparison was revisited, an alert was useful, CI was adopted, the SDK remained
installed, and the participant expressed willingness to pay.

#### Scenario: Participant praises the first report but does not return
- **WHEN** no repeated operational behavior occurs
- **THEN** the participant is not counted as recurring-value validation

### Requirement: Predeclared decision gate
Before enrollment, the pilot SHALL define quantitative and qualitative thresholds for proceeding,
iterating, or stopping Developer Monitor investment.

#### Scenario: Cohort completes below the proceed threshold
- **WHEN** pilot results are reviewed
- **THEN** paid infrastructure and billing remain inactive
- **AND** the decision is recorded as iterate or stop with evidence

### Requirement: Manual operations are disclosed and bounded
Any manual or temporary pilot operation SHALL be documented, access-controlled, auditable, and
excluded from claims of general product availability.

#### Scenario: Maintainer manually prepares a weekly summary
- **WHEN** prompt-free reports are accessed for that purpose
- **THEN** the access and output follow the accepted pilot boundary

### Requirement: Participant exit and deletion
Participants SHALL be able to leave the pilot and request export or deletion of retained pilot data,
and pilot data SHALL be deleted at the declared retention deadline.

#### Scenario: Participant withdraws
- **WHEN** a valid deletion request is received
- **THEN** retained reports and participant identifiers are removed within the declared period
