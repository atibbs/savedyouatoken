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

### Requirement: Releases are verified before they become `latest`
A newly built version SHALL be verified by installing and running it from the registry in a clean
environment **before** it is promoted to the `latest` tag, so that a broken build never becomes the
default install. The version a user installs SHALL report the version it was published as.

#### Scenario: A candidate is verified before promotion
- **WHEN** a new version is published to a candidate tag rather than directly to `latest`
- **THEN** it is installed from the registry in a clean environment and asserted to run and report its
  published version
- **AND** it is promoted to `latest` only if that check passes

#### Scenario: A broken build never becomes `latest`
- **WHEN** the candidate fails its verification
- **THEN** the release fails and `latest` continues to point at the previous good version
