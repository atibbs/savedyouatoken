## Purpose

Defines collaboration and governance controls that let multiple people own workflows, review cost
changes, and enforce shared policies without weakening tenant isolation.

## ADDED Requirements

### Requirement: Shared workspaces and ownership
Team customers SHALL organize workflows in shared workspaces and SHALL assign an accountable owner
or team to each monitored workflow.

#### Scenario: Regression has an owner
- **WHEN** a workflow crosses its active policy
- **THEN** the regression identifies the responsible owner and workspace

### Requirement: Role-based access
Workspaces SHALL provide least-privilege roles for viewing, editing policies, administering members,
managing billing, and deleting data.

#### Scenario: Viewer attempts to change a policy
- **WHEN** their role lacks policy permission
- **THEN** the change is denied and no policy state changes

### Requirement: Central policy management
Authorized users SHALL define inherited workspace policies with documented precedence and controlled
workflow-level exceptions.

#### Scenario: Workflow exception exists
- **WHEN** a workspace default and approved workflow override both apply
- **THEN** evaluation uses the documented precedence and records the exception

### Requirement: Auditable governance actions
Membership, role, ownership, policy, retention, export, deletion, and integration changes SHALL
produce tamper-evident audit events visible to authorized administrators.

#### Scenario: Administrator investigates a budget change
- **WHEN** they inspect the workflow audit trail
- **THEN** they can identify who changed the policy, when, and from which prior value

### Requirement: Team notification routing
Workspaces SHALL route regression notifications by workflow ownership and escalation policy while
deduplicating repeated events.

#### Scenario: Owned workflow regresses
- **WHEN** its policy requires notification
- **THEN** configured owner and team destinations receive one attributable event
