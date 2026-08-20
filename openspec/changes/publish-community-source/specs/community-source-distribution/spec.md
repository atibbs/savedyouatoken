## Purpose

Defines the release and trust conditions under which savedyouatoken's Community components become
publicly accessible, MIT-licensed, independently buildable, and accurately represented.

## ADDED Requirements

### Requirement: Public Community source access
The analysis engine, CLI, runtime SDK, local-first web analyser, agent kit, shared contracts, tests,
examples, and public documentation SHALL be readable and forkable from a public repository under the
MIT license.

#### Scenario: Developer follows an npm source link
- **WHEN** a developer follows repository metadata from a Community package
- **THEN** it resolves to the corresponding source in the public repository

### Requirement: Independent Community operation
A fresh public clone SHALL install, build, test, and run all Community surfaces without access to
private packages, private registries, maintainer credentials, or hosted Monitor infrastructure.

#### Scenario: Contributor uses an unconfigured clone
- **WHEN** they follow the documented setup on a supported environment
- **THEN** all Community verification commands complete without private configuration

### Requirement: Commercial boundary separation
Hosted authentication, persistence, entitlements, billing, customer administration, alerts, and
private operations SHALL NOT be required implementation dependencies of the public repository.

#### Scenario: Monitor code is unavailable
- **WHEN** the Community repository is built without the private control-plane repository
- **THEN** local analysis, SDK capture, CLI enforcement, and the static web analyser remain complete

### Requirement: Publication safety gate
Repository visibility SHALL NOT become public until the working tree and full history have been
reviewed for credentials, sensitive data, private implementation, redistribution rights, and
accidental artifacts, with exposed credentials revoked or rotated.

#### Scenario: Historical credential is detected
- **WHEN** the publication audit finds a credential in any commit
- **THEN** publication is blocked until the credential is revoked or rotated
- **AND** the public history no longer contains it

### Requirement: Contributor and security entry points
The public repository SHALL publish contribution, conduct, governance, support-boundary, and private
security-reporting instructions before accepting public issues or pull requests.

#### Scenario: Researcher finds a vulnerability
- **WHEN** they read the repository security policy
- **THEN** they can report it privately without opening a public issue

### Requirement: Reproducible protected releases
Published Community packages SHALL be built from reviewed public tags through protected CI, SHALL
expose matching source and license metadata, and SHALL have their package contents verified before
release.

#### Scenario: User audits an npm release
- **WHEN** they compare the package version with its public tag
- **THEN** they can identify the reviewed source and release workflow that produced it

### Requirement: Accurate open-source claims
Project surfaces SHALL describe savedyouatoken as planned for open source while the repository is
private and SHALL use present-tense open-source language only after public access is verified.

#### Scenario: Repository remains private
- **WHEN** marketing or documentation is rendered before publication
- **THEN** it does not claim the project is currently open source
