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
A build SHALL be verified **through its installed command** — the `savedyouatoken` executable, not a
file invoked directly — before it is published to `latest`, so that a broken build or a broken entry
point never becomes the default install. Verification SHALL exercise the installed command for both
the version it reports and one real audit.

#### Scenario: The built artifact is verified before it is published
- **WHEN** a release is triggered
- **THEN** the packaged CLI is installed into a clean environment and run through its installed
  `savedyouatoken` command, asserting it reports the version being released and completes a real audit
- **AND** it is published to `latest` only if that verification passes

#### Scenario: A broken build is never published
- **WHEN** verification fails
- **THEN** nothing is published and `latest` continues to point at the previous good version

### Requirement: Releases are idempotent and monotonic
A release SHALL be skipped when its version is already published, so that rerunning after a partial
failure does not attempt to republish an immutable version. A release SHALL be rejected when its
version is not greater than the current `latest`.

#### Scenario: An already-published version is not re-released
- **WHEN** a release runs for a version that already exists on npm
- **THEN** no publish is attempted and the run succeeds

#### Scenario: A non-increasing version is rejected
- **WHEN** a release runs for a version that is not greater than the current `latest`
- **THEN** the release fails
