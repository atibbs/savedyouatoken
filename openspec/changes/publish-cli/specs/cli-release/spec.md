## Purpose

Publishing the CLI to npm and keeping the published `latest` version current with the pricing
catalogue, so that `npx savedyouatoken@latest` is a trustworthy, always-current launcher for the
kit, the agent-skill, and any other "run the live tool" instruction.

## ADDED Requirements

### Requirement: The CLI is installable from npm
The CLI SHALL be published to npm under a stable package name such that `npx savedyouatoken@latest`
resolves, installs, and runs its documented commands.

#### Scenario: A fresh environment can run the CLI
- **WHEN** `npx savedyouatoken@latest` is run in a clean environment with no prior install
- **THEN** the package resolves and installs
- **AND** it executes and reports its version

### Requirement: The published `latest` reflects current prices
Because the CLI carries the pricing catalogue, a new version SHALL be published whenever the
catalogue in `packages/core` changes, so the npm `latest` tag never quotes prices older than the
repository's current catalogue.

#### Scenario: A price change triggers a release
- **WHEN** the pricing catalogue changes and lands on the main branch
- **THEN** a new CLI version carrying that catalogue is published to npm as `latest`

#### Scenario: latest is not older than the repository catalogue
- **WHEN** the published `latest` version and the repository's current catalogue are compared
- **THEN** the published catalogue is not older than the repository's

### Requirement: A price change cannot merge without a release
CI SHALL fail when the pricing catalogue changes without a corresponding version bump, so a catalogue
edit cannot reach `latest`-eligible state without triggering a publish.

#### Scenario: Catalogue changed but version not bumped
- **WHEN** a change modifies the pricing catalogue but does not bump the CLI's published version
- **THEN** CI fails and reports the missing version bump

### Requirement: Releases are verified before they are trusted
Each release SHALL be verified by running the just-published package from a clean environment before
the release is considered complete.

#### Scenario: Post-publish smoke test
- **WHEN** a version has been published
- **THEN** running `npx savedyouatoken@<published-version>` in a clean environment executes and
  reports that version
- **AND** a failed smoke test marks the release as failed
