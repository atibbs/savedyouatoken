## Why

The repository is private, so the project cannot accurately claim to be open source despite its MIT
license. Public source is especially valuable for software that inspects sensitive prompts and wraps
production provider clients because users can verify privacy and safety claims directly.

## What Changes

- Separate hosted authentication, persistence, entitlement, billing, and Monitor implementation
  into a private `savedyouatoken-cloud` repository.
- Audit the working tree and full Git history for secrets, sensitive data, redistribution rights,
  local artifacts, and private implementation.
- Add contributor, conduct, security, governance, support-boundary, and release documentation.
- Make Community packages reproducibly buildable and testable from a fresh public clone.
- Correct package metadata, public links, protected CI releases, provenance, and website language.
- Publish the Community repository only after every release gate passes.

## Capabilities

### New Capabilities

- `community-source-distribution`: Public, MIT-licensed, independently buildable distribution of the
  analysis engine, CLI, SDK, web analyser, agent kit, shared contracts, tests, and documentation.

### Modified Capabilities

None.

## Impact

Touches repository boundaries, Git history, CI and npm release configuration, project governance,
package metadata, public documentation, and selected `apps/web` stateful modules. The local free
product remains static and zero-cost. The private hosted repository remains optional infrastructure;
publication itself introduces no required paid service or always-on dependency.
