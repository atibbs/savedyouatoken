# Community publication audit log

This log records evidence for the `publish-community-source` release gate. A checked preparation
item is not permission to make the repository public; publication remains blocked until every gate
in the OpenSpec change is complete.

Actions that require repository-owner authority are tracked separately in the
[`community-publication-owner-checklist.md`](community-publication-owner-checklist.md).

## 2026-08-13 — inventory and contributor-readiness tranche

### Repository topology

- Reviewed all tracked paths and recorded their classification in
  [`community-boundary.md`](community-boundary.md).
- Confirmed there are currently no Git tags, submodules, or Git LFS objects.
- Defined the proposed publication set as reviewed `main` ancestry plus future protected `v*` tags.
- Recorded that all non-`main` remote branches must be archived privately and removed before a
  visibility change.
- Confirmed generated archives, build output, local environment files, local agent settings, and
  package tarballs are ignored and are not tracked.

### Package contents

- Inspected npm dry-run manifests for `savedyouatoken`, `@savedyouatoken/sdk`, and
  `@savedyouatoken/core`.
- Added MIT license files to every package tarball and package-level README files where missing.
- Restricted the core tarball to `src` and `contracts`; tests and workspace configuration had
  previously been included implicitly.
- Confirmed the CLI tarball contains its executable bundle, README, license, and manifest only.
- Confirmed the SDK tarball contains its bundle, declarations, README, license, and manifest only.
- Confirmed built CLI and SDK output contains no maintainer filesystem path.
- Verified an installed CLI tarball reports its version and runs a real audit.
- Verified a clean NodeNext consumer typechecks against the packed SDK.

No funding URL is recorded because the project has not designated an official Community funding
channel. Omitting a funding field is preferable to publishing an unverified destination.

### Project entry points

- Added the root MIT license, contribution guide, code of conduct, security and supported-version
  policy, governance statement, support boundary, issue forms, and pull-request template.
- Added weekly npm and GitHub Actions Dependabot configuration.
- Added repository, issue, documentation, and license metadata to each workspace manifest.
- Confirmed GitHub Discussions is not enabled; support therefore uses the question issue form.
- Confirmed private vulnerability reporting is not yet enabled or available at the documented URL
  while the repository is private. Enabling and testing it remains a publication gate.

### Verification

- `npm run typecheck` — passed.
- `npm test` — passed: 153 tests across core, SDK, and web.
- `npm run build:cli` and `npm run verify:cli` — passed.
- `npm run build:sdk` and `npm run verify:sdk-types` — passed.
- `npm run build --workspace @savedyouatoken/web -- --webpack` — passed; 86 static pages generated.
- `npm run openspec:validate` — passed: 12 items.

The default Turbopack build could not run in the restricted local verification environment because
its CSS worker attempted to bind an internal port. The webpack production build passed. Protected
CI must still run the default build before this tranche merges.

### Remaining blockers

- Create and back up the private `savedyouatoken-cloud` repository.
- Extract the exact private-control-plane paths listed in the boundary inventory.
- Remove the resulting private-only dependencies and verify an unconfigured clean clone.
- Complete working-tree and full-history secret, sensitive-data, rights, and license scans.
- Verify font redistribution rights.
- Add protected CI checks for secrets, licenses, dependencies, and package contents.
- Enable and test private vulnerability reporting.
- Configure protected tag-based package releases and perform the final maintainer review.
