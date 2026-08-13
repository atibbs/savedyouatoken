## 1. Boundary inventory

- [ ] 1.1 Inventory every package, app route, workflow, deployment file, migration, asset, document, and generated artifact
- [ ] 1.2 Classify each path as public Community, private control plane, or shared contract and record approval
- [ ] 1.3 Create a private `savedyouatoken-cloud` repository with protected access and a recovery backup
- [ ] 1.4 Move auth, persistence, entitlement, billing, webhook, customer administration, and private operations code
- [ ] 1.5 Replace required repository crossings with versioned public contract dependencies
- [ ] 1.6 Verify Community packages and the static analyser have no private build or runtime dependency

## 2. Publication safety audit

- [ ] 2.1 Define the exact branches, tags, history, submodules, LFS objects, and release artifacts to publish
- [ ] 2.2 Scan the working tree and complete history for credentials, private keys, tokens, cookies, and environment files
- [ ] 2.3 Review history for customer prompts, reports, personal data, internal URLs, screenshots, logs, and commercial notes
- [ ] 2.4 Review third-party source, assets, fonts, datasets, and dependencies for redistribution compatibility
- [ ] 2.5 Remove package tarballs, local settings, build output, and accidental artifacts from the publication set
- [ ] 2.6 Revoke or rotate every exposed credential and remediate history before continuing
- [ ] 2.7 Have a maintainer manually review the exact fresh clone and history proposed for publication

## 3. Public project readiness

- [ ] 3.1 Verify MIT copyright attribution and add `CONTRIBUTING.md`
- [ ] 3.2 Add `CODE_OF_CONDUCT.md`, `SECURITY.md`, private reporting instructions, and supported-version policy
- [ ] 3.3 Add governance, maintainer authority, Community support boundary, and issue/PR templates
- [ ] 3.4 Add dependency, secret, package-content, and license checks to protected CI
- [ ] 3.5 Correct repository, issue tracker, documentation, funding, and license metadata in every package
- [ ] 3.6 Document fresh-clone setup, architecture boundaries, releases, and local-only operation

## 4. Reproducible release preparation

- [ ] 4.1 Build and test the public repository from a clean unconfigured clone on every supported runtime
- [ ] 4.2 Inspect CLI and SDK tarballs, source maps, declarations, licenses, and filesystem paths
- [ ] 4.3 Configure protected tag-based npm publishing with least privilege and provenance
- [ ] 4.4 Produce and install exact-version release candidates from the reviewed public commit
- [ ] 4.5 Prepare release notes explaining Community scope, private Monitor scope, contribution, and security handling

## 5. Publication

- [ ] 5.1 Freeze nonessential changes and re-run the complete release gate
- [ ] 5.2 Confirm repository backup, visibility target, branch protection, release permissions, and maintainer access
- [ ] 5.3 Change the reviewed Community repository visibility to public
- [ ] 5.4 Publish or verify matching npm releases from protected public tags
- [ ] 5.5 Update website and documentation wording from planned to presently open source only after access is verified
- [ ] 5.6 Add public source, license, contribution, and security links to product pages and package registries

## 6. Post-publication verification

- [ ] 6.1 Test anonymous clone, issue navigation, package source links, installation, build, test, and static deployment
- [ ] 6.2 Monitor security reports, package provenance, install failures, and support load during the launch window
- [ ] 6.3 Run typecheck, all tests, all package builds, web production build, history scans, and release-content checks
