# Repository-owner checklist for Community publication

The implementation work in `publish-community-source` can largely be prepared through pull
requests, but several actions require the repository and package owner to make a decision, confirm
ownership, or change external settings. This checklist is the maintainer handoff for those actions.

Do not make the current repository public until every launch-gate item below is complete.

## 1. Approve the source boundary

- [ ] Review and approve [`community-boundary.md`](community-boundary.md), especially every path
  classified as private control plane.
- [ ] Confirm that hosted authentication, persistence, entitlement, billing, customer
  administration, alerts, and Monitor operations should remain private.
- [ ] Decide whether public roadmap and commercial-strategy documents may remain in public history.

**Evidence:** approval or merge of the boundary pull request, with any exceptions recorded in the
boundary document.

## 2. Establish the private recovery boundary

- [x] Create the private `savedyouatoken-cloud` repository under the intended long-term owner.
  Created 2026-08-19 — see the [audit log](community-publication-audit.md#2026-08-19--private-cloud-repository-created-and-backed-up).
- [x] Limit repository access to the people who should see hosted and commercial implementation.
  Confirmed 2026-08-20.
- [x] Create and verify a recoverable private backup of the current repository, including all
  branches, tags, and history, before any extraction or history rewrite. Verified 2026-08-19: every
  branch's commit hash matches between source and backup (no tags exist in this repository).
- [x] Confirm where private infrastructure, deployment configuration, and operational documentation
  will live. Decided 2026-08-20: `savedyouatoken-cloud`'s own `docs/`.

**Evidence:** private repository URL, access review, and a dated successful backup/restore check. Do
not record private backup locations or credentials in the Community repository.

## 3. Make credential and history decisions

- [ ] Review the tree/history scan findings produced during the publication audit.
- [ ] Revoke or rotate every exposed credential, even if it appears inactive or is removed from
  history.
- [x] Choose either reviewed existing ancestry or a clean-root public history based on the audit.
  Decided 2026-08-19: clean-root — see
  [`community-boundary.md`](community-boundary.md#proposed-publication-topology). Not yet executed;
  scoped as a final-release-prep step.
- [x] Confirm that all non-`main` remote branches are privately archived and safe to remove before
  visibility changes. Done 2026-08-19: 24 fully-merged branches deleted (their content already
  lives in `main`'s history, so nothing was lost). 4 branches remain — open Dependabot dependency-bump
  PRs (#21–24) — left alone since deleting a branch under an open PR is messy; merge or close those
  PRs first, then delete the branches, before the visibility change.

**Evidence:** a redacted audit sign-off listing scan scope, remediation status, and the chosen history
strategy. Never record credential values in the sign-off.

## 4. Confirm redistribution rights

- [ ] Confirm the project owns or may redistribute the bundled Manrope and DM Mono font files.
- [ ] Review third-party source, assets, examples, datasets, and copied documentation flagged by the
  audit.
- [ ] Resolve any attribution or license obligations before approving the publication candidate.

**Evidence:** a rights inventory naming each bundled asset, its source, license, and required
attribution.

## 5. Configure public-project security and governance

- [ ] Enable GitHub private vulnerability reporting and test the advisory link in `SECURITY.md`.
  Confirmed blocked while private (checked 2026-08-20): GitHub's own docs describe this feature
  only for public repositories, its real navigation path is under Settings → **Advanced
  Security** (not the general "Code security" page), and `repos/{owner}/{repo}` exposes no
  security/advanced-security fields at all for this repo — `PUT
  .../private-vulnerability-reporting` 404s rather than enabling it. Same class of restriction
  as branch/tag protection below; configurable once public (or on a plan with GHAS).
- [x] Enable Dependabot alerts. Confirmed enabled 2026-08-20 (`GET
  repos/{owner}/{repo}/vulnerability-alerts` now returns 204, was 404 before).
- [ ] Enable secret/code scanning (GitHub Advanced Security) for the repository. Confirmed
  blocked 2026-08-20, same class of restriction as the other GHAS-gated items: enabling secret
  scanning via the API returns 422 "Secret scanning is not available for this repository";
  code scanning's default-setup endpoint 403s. Not a substitute for this repo's own CI secret
  scan (`gitleaks`, already running on every push and PR — see task 3.4) or `npm audit`
  (task 3.4) — those already cover what these would add, until public unlocks them too.
- [ ] Configure `main` and release-tag protection (rulesets for `cli-v*`/`sdk-v*`), required
  checks, review requirements, and least privilege maintainer access. Confirmed blocked while
  private, same as branch protection: `repos/{owner}/{repo}/rulesets` 403s with "Upgrade to
  GitHub Pro or make this repository public to enable this feature." Configurable the moment
  either condition is met.
- [x] Confirm whether GitHub Discussions should be enabled. Decided 2026-08-20: leave it off —
  issue-based support stays the sole channel until there's actual community demand for it, same
  wait-for-signal approach already applied to the Pro tier. `SUPPORT.md` already reflects this;
  no change needed. Revisit post-launch if demand shows up.
- [x] Choose an official security/conduct contact. Decided 2026-08-20: GitHub-native only —
  `SECURITY.md` (Security Advisories) and `CODE_OF_CONDUCT.md` (private maintainer message)
  already describe this and needed no change. No separate email address.

**Evidence:** screenshots or a private settings record plus an anonymous/private-channel test. Do not
commit sensitive configuration exports.

## 6. Authorize package publishing

- [ ] Confirm the npm owners for `savedyouatoken`, `@savedyouatoken/sdk`, and any future public core
  package.
- [ ] Configure npm trusted publishers to match the protected GitHub tag workflows.
- [ ] Revoke bootstrap or maintainer tokens after OIDC publishing is proven.
- [ ] Approve the exact release-candidate versions and release notes.

**Evidence:** successful provenance-bearing release candidates or releases that map to reviewed
public commits and tags.

## 7. Perform the final publication review

- [ ] Clone the exact candidate anonymously or from an account with no private-repository access.
- [ ] Follow the Community setup guide without private packages, registries, credentials, or hosted
  infrastructure.
- [ ] Inspect the candidate history, repository navigation, package source links, generated kit, and
  website language.
- [ ] Record explicit go/no-go approval after every OpenSpec release gate passes.

**Evidence:** dated maintainer sign-off in the publication audit. A failed check means no-go.

## 8. Execute the irreversible launch

- [ ] Freeze nonessential changes and verify the private backup again.
- [ ] Change the reviewed Community repository visibility to public.
- [ ] Verify anonymous access before changing the website to present-tense open-source language.
- [ ] Publish or verify matching npm releases from the protected public tags.
- [ ] Monitor advisories, install failures, provenance, issues, and support load during launch.

Repository visibility is the irreversible step. If verification fails after publication, fix forward;
do not assume making the repository private again retracts source already copied.

## Work that can be delegated to Codex

The repository owner does not need to perform every mechanical step. Codex can prepare the cloud
extraction, public contracts, CI checks, scan commands and redacted reports, dependency cleanup,
package verification, release workflows, documentation, and website changes. The owner still needs
to authorize external repository/settings changes, handle credential rotation, confirm rights and
ownership, approve the exact publication candidate, and perform or explicitly accept the final
visibility change.
