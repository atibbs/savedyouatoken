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

## 2026-08-18 — secret, sensitive-data, and redistribution-rights scan

### Secret and credential scan (task 2.2)

- Installed `gitleaks` (v8.30.1) and ran it against full history on every local ref
  (`gitleaks git --log-opts "--all"`, 66 unique commits across `main` and all working branches):
  **no leaks found**.
- Cross-checked with a manual pattern grep (AWS keys, PEM/OpenSSH private key headers, Stripe/OpenAI
  live-key shapes, Slack tokens, Google API keys) across every commit in history: no matches.
- The only tracked `.env`-shaped file in history is `apps/web/.env.example`, which contains only
  placeholder keys and no values. `.gitignore` already excludes `.env`, `.env.local`, and
  `.env.*.local`.
- No private keys, tokens, or credential files were ever committed. This tranche found nothing to
  revoke or rotate, but revocation/rotation authority still sits with the repository owner per the
  [owner checklist](community-publication-owner-checklist.md#3-make-credential-and-history-decisions)
  and this scan does not substitute for that sign-off.

### Sensitive-data and internal-notes review (task 2.3)

- No images, screenshots, or video/log binaries have ever been committed (checked via
  `git log --all --diff-filter=A --name-only` for image/media extensions).
- No email addresses appear in tracked source (excluding lockfiles and standard placeholder domains
  like `example.com`).
- No internal-only URLs (staging/admin hosts) appear in tracked source; the only `localhost` mention
  is a normal local-dev instruction in `README.md`.
- `examples/*.txt` and the `report.*` contract fixtures are synthetic demo/test data with placeholder
  values (e.g. `{{queue_depth}}`, fixed 2026-08-13 timestamps) — not real customer prompts or reports.
- The local monitoring workbench (`docs/local-monitoring-workbench.md`) stores user report data
  outside the repository, under `~/.savedyouatoken/workbench` or `$SAVEDYOUATOKEN_WORKBENCH_DIR`, so
  it cannot leak real usage data into git history.
- No commercial-strategy or roadmap documents were flagged as inappropriate for public history in
  this pass; that determination remains an owner decision per the checklist.

### Third-party redistribution review (task 2.4)

- Ran `license-checker` across the full dependency graph (231 packages). All resolved to permissive
  licenses (MIT, ISC, Apache-2.0, BSD-3-Clause, MPL-2.0, 0BSD, Unlicense) except:
  - `@img/sharp-libvips-darwin-arm64` / `@img/sharp-wasm32` — LGPL-3.0-or-later / mixed
    Apache-2.0+LGPL-3.0+MIT. Transitive build-time dependency of Next.js image optimization; LGPL
    permits redistribution as an unmodified dependency and does not require the application itself
    to be LGPL-licensed. No action needed.
  - `caniuse-lite` — CC-BY-4.0 (attribution). Transitive build-tool data used by Browserslist at
    build time only; not shipped in any published package or runtime bundle.
  - `postgres` — Unlicense (public domain), more permissive than MIT.
- The only runtime dependency actually bundled into the published `savedyouatoken` CLI and
  `@savedyouatoken/sdk` tarballs is `gpt-tokenizer` (MIT). `@savedyouatoken/core` ships with zero
  runtime dependencies.
- Verified the two bundled web fonts' redistribution rights and added their license text next to the
  font files:
  - Manrope (`apps/web/app/fonts/manrope-*.woff2`) — SIL Open Font License 1.1, Copyright 2018 The
    Manrope Project Authors. License text added at `apps/web/app/fonts/manrope-OFL.txt`.
  - DM Mono (`apps/web/app/fonts/dmmono-*.woff2`) — SIL Open Font License 1.1, Copyright 2020 The DM
    Mono Project Authors. License text added at `apps/web/app/fonts/dmmono-OFL.txt`.
  - Both confirmed against the canonical `google/fonts` repository (`ofl/manrope/OFL.txt`,
    `ofl/dmmono/OFL.txt`). OFL explicitly permits bundling/embedding fonts with software provided the
    license text travels with them, which was the only gap found.
- No other vendored third-party source, datasets, or copied documentation were found in the tree.

### Protected CI checks (task 3.4)

Added four gates to `.github/workflows/ci.yml`, run on every push and pull request before the build
steps, so a regression fails fast:

- **Secret scan** — installs the gitleaks binary directly (MIT-licensed CLI tool; deliberately not
  the `gitleaks-action` wrapper, which requires a paid license for private repositories) and runs
  `gitleaks git --log-opts="--all"` over full history.
- **Dependency vulnerability scan** — `npm audit --omit=dev --audit-level=high` against production
  dependencies only.
- **License compatibility scan** — `npm run check:licenses` (new `scripts/check-licenses.mjs`, using
  the `license-checker` devDependency) fails if any dependency resolves to a license outside the
  allow-list established in the task 2.4 review above.
- **Publishable package content scan** — `npm run check:package-contents` (new
  `scripts/check-package-contents.mjs`) packs `savedyouatoken`, `@savedyouatoken/sdk`, and
  `@savedyouatoken/core` and fails if any file outside each package's expected allow-list (license,
  readme, manifest, `dist/`, or for core `src/`/`contracts/`) appears in the tarball.

All four gates were run locally against the current tree before landing: no leaks, 0 high/critical
production vulnerabilities, all 291 resolved dependencies within the allow-list, and all three
tarballs contain only their expected files. `npm run typecheck`, `npm test` (99 tests across core,
SDK, CLI, and web), and `npm run build` all still pass.

### Draft release notes (task 4.5)

Added [`community-release-notes.md`](community-release-notes.md), a draft of the notes to publish
alongside the actual visibility change. It covers Community scope (engine, web analyser, CLI, SDK,
agent kit, local workbench), what stays private (hosted Monitor, accounts, billing, in
`savedyouatoken-cloud`) and why the split exists, the contribution workflow, and security-reporting
handling. It is explicitly marked as a draft not to be published or acted on until the owner
checklist's final-review and launch sections are complete.

### Remaining blockers

- Create and back up the private `savedyouatoken-cloud` repository.
- Extract the exact private-control-plane paths listed in the boundary inventory.
- Remove the resulting private-only dependencies and verify an unconfigured clean clone.
- Enable and test private vulnerability reporting.
- Configure protected tag-based package releases and perform the final maintainer review.
- Finalize and date the draft release notes against the actual release version at publication time.
- Owner sign-off on this scan (§3 of the owner checklist) before any credential-rotation or
  history-strategy decision is finalized.

## 2026-08-19 — private cloud repository created and backed up

### Recovery backup (task 1.3)

- The repository owner created `github.com/atibbs/savedyouatoken-cloud`. On creation it was
  briefly **public**; caught before any content was pushed (`isEmpty: true` at the time), flagged,
  and the owner switched it to private. Verified directly against the REST API afterward
  (`private: true, visibility: "private"`), not just the creation UI, before anything was written
  to it.
- Backed up every branch and tag from `savedyouatoken` into it: `git clone --mirror` of the source
  followed by `git push --all` and `git push --tags` to the cloud repository (run by the repository
  owner directly, not CI).
- Verified the backup by comparing `git ls-remote` output for both repositories, restricted to
  `refs/heads/*` and `refs/tags/*` (GitHub's auto-generated `refs/pull/*` refs are excluded from
  both sides — they cannot be pushed to another repository and GitHub regenerates them itself, so
  they are not part of what "backup" means here): **26 branches, 0 tags** (confirmed earlier that
  this repository has no tags), every commit hash identical between source and backup.
- This satisfies the owner checklist's evidence requirement for
  [§2](community-publication-owner-checklist.md#2-establish-the-private-recovery-boundary)
  ("a dated successful backup/restore check"). Still open in that section: limiting
  `savedyouatoken-cloud`'s access to the intended people, and confirming where private
  infrastructure/deployment/operational documentation will live within it.
- No local working copy of `savedyouatoken-cloud` exists yet — the backup was pushed from a
  disposable mirror clone, not a persistent checkout. Task 1.4 (extracting the private
  control-plane paths into it) will need one, and is unstarted.

## 2026-08-19 — clean-clone build verification (task 4.1)

Built and tested `main` (`d8eb33d`) from a fresh, unconfigured clone — no `.env`/`.env.local`, no
prior `node_modules`, no npm/tsup cache within the clone — on both ends of the supported range:

- **Node 20.20.2** (the `engines.node` floor, `>=20.9.0`)
- **Node 22.23.2** (matches `release.yml`/`release-sdk.yml`'s `node-version: 22`; GitHub-hosted
  runners themselves have started defaulting to Node 24, per a deprecation notice seen in recent
  Actions logs, so the newer end of the range is moving further up over time)

On each: `npm ci`, `npm run typecheck`, `npm test` (102 tests), `npm run build` (webpack — the
default Turbopack build cannot bind its CSS worker's port in this sandboxed environment, a
sandbox-specific limitation already noted in the 2026-08-13 tranche above, not a product issue; the
default build already runs successfully in protected CI), `npm run build:cli` + `verify:cli`
(installed shim correctly reports `0.2.0` and runs a full audit/regression/workbench pass),
`npm run build:sdk` + `verify:sdk-types`, `npm run build:kit`, and `npm run openspec:validate` — all
passed identically on both runtimes, with no configuration beyond the committed lockfile.

## 2026-08-19 — private control-plane extraction (task 1.4)

Deleted the dormant private-control-plane implementation from this repository. It is not lost: the
2026-08-19 full-history backup into `savedyouatoken-cloud` already contains every one of these files
exactly as they were, so nothing needed to be separately copied there.

### What was removed

15 files/directories: `apps/web/auth.ts`, `apps/web/types/next-auth.d.ts`,
`apps/web/app/api/{auth,billing,checkout,me,prompts,stripe}/`, `apps/web/drizzle.config.ts`,
`apps/web/drizzle/`, `apps/web/lib/db/`, `apps/web/lib/entitlements.ts`, `apps/web/lib/stripe.ts`,
`apps/web/components/AccountMenu.tsx`, `apps/web/components/UpgradeButton.tsx` — every path
`community-boundary.md` classified as private control plane. `apps/web/app/api/` no longer exists;
this repository now has zero server routes.

### Why this was safe to remove today

Verified before touching anything, not assumed:

- Grepped every file in the app for imports of the private cluster. Every file in the cluster only
  imports from *within* the cluster, except exactly two crossing points from public code:
  `apps/web/app/layout.tsx` (rendered `<AccountMenu />`) and `apps/web/app/pricing/page.tsx`
  (rendered `<UpgradeButton />`). No test file references any of it.
- `docs/deployment.md` and `docs/decisions.md` already establish that this boundary is inert in
  production today: zero environment variables are configured on the live deployment, "no
  account/Sign in control appears," and there is a standing, dated decision
  ("Defer the Pro tier — keep it specced, do not build the paid product yet") to not build the paid
  features on top of it. Removing it changes nothing about what a visitor to savedyouatoken.com
  experiences today — `AccountMenu` already rendered nothing (`authConfigured: false`) and
  `UpgradeButton` already showed a disabled "Checkout not connected" state.

### Public-code changes

- `apps/web/app/layout.tsx`: dropped the `AccountMenu` import and usage. Rendered output is
  unchanged (it already rendered nothing).
- `apps/web/app/pricing/page.tsx`: dropped the `UpgradeButton` import and usage, replaced with a
  static, honest "Not yet available" state — no fabricated functionality, no dead reference to a
  component that no longer exists in this repository.
- `apps/web/package.json`: removed `next-auth`, `drizzle-orm`, `drizzle-kit`, `postgres`, `stripe`,
  and the `db:generate`/`db:push` scripts (task 1.6). `npm install` afterward removed 23 packages
  from the tree and, as a side effect, resolved 3 of the 4 pre-existing moderate `npm audit`
  findings (they were transitive to `drizzle-kit`'s bundled `esbuild`/`@esbuild-kit/*`).
- `apps/web/.env.example`: removed the Auth/Database/Stripe variable blocks; only the two public
  site variables remain.
- Updated every doc that described this boundary as present in this repository rather than moved:
  `community-boundary.md` (the authoritative inventory — every affected row now says "Extracted
  2026-08-19"), `deployment.md`, `monetization.md`, `future-roadmap.md`, `open-source-plan.md`, and
  `openspec/config.yaml` (the AI context primer fed to future OpenSpec work on this repo — this one
  mattered most to get right, since a stale primer would actively mislead future changes). Left
  `docs/decisions.md`'s existing "Defer the Pro tier" entry untouched as a historical record, and
  left the *other* OpenSpec changes' forward-looking references to Auth.js/Drizzle/Stripe as-is
  where they describe what `savedyouatoken-cloud` will eventually need, not this repository's
  current state — one exception: `launch-developer-monitor/design.md`'s context paragraph was
  present-tense-wrong ("the existing repository has dormant... boundaries that will live in a
  private repository") and got a one-line tense fix.

### Verification

- Full local pass after: `npm run typecheck`, `npm test` (102 tests), `npm run build` (webpack, same
  sandbox note as above), `npm run build:cli` + `verify:cli`, `npm run build:sdk` +
  `verify:sdk-types`, `npm run build:kit`, `npm run check:licenses` (269 dependencies, down from 292
  — the removed packages), `npm run check:package-contents`, `gitleaks git --log-opts="--all"` (no
  leaks), `npm audit --omit=dev --audit-level=high` (0 vulnerabilities), `npm run
  openspec:validate` — all passed.
- Visually verified in a browser: home page header renders identically to before (no account
  control, matching production); `/pricing` renders the new static "Not yet available" state with
  no console errors.
- Task 1.5 ("replace repository crossings with versioned public contract dependencies") is
  deliberately left unstarted: there is no live cross-repo integration to replace yet, since Monitor
  is unbuilt. Revisit when `savedyouatoken-cloud` actually consumes a published contract.

## 2026-08-19 — strategy and monetization documents extracted

Following review of `community-boundary.md` (task 1.1's classification pass), the owner decided
several documents should not be public at all, independent of the credential/secrets scan (task
2.2 found nothing sensitive in any of them) — the concern is competitive/strategic exposure, a
separate category task 2.3 flagged as needing owner judgment ("commercial notes require
sensitive-content review before publication"). This is that review's outcome.

### What was removed

11 paths, all product-strategy, monetization, growth, discovery, roadmap, or business-planning
content: `docs/monetization.md`, `docs/product-discovery.md`, `docs/product-platform-strategy.md`,
`docs/growth.md`, `docs/future-roadmap.md`, `docs/decisions.md`, `openspec/PRIORITIES.md`, and the
four OpenSpec change directories `launch-developer-monitor/`, `validate-monitor-pilot/`,
`expand-team-enterprise-ecosystem/`, `agent-kit-download/`. `docs/decisions.md` and `PRIORITIES.md`
mix technical and business content; the owner chose wholesale removal over a surgical split.
`agent-kit-download`'s resulting *feature* (the `/kit` page, CTAs, and `kit/` source) stays public —
only the specs explaining the monetization reasoning behind it moved.

Preserved, not deleted: every one of these paths exists exactly as it was in the 2026-08-19
full-history `savedyouatoken-cloud` backup (predates this removal).

### The history problem, and the decision it forced

These files are present from this repository's first commit (2026-08-10) onward. Deleting them
today only removes them from the tree going forward — every past commit remains inspectable, and
would still show their full content if `main`'s real ancestry were published as previously planned
(2026-08-13 tranche above: "reviewed existing ancestry... nothing to hide," which was evaluating
credential exposure, not this category).

**Decision: publish a clean-root history for the Community repository instead of `main`'s real
ancestry.** Recorded in `community-boundary.md`'s "Proposed publication topology." This is **not
yet executed** — it is scoped as a final-release-prep, do-once step (owner checklist §8 / tasks.md
5.1), performed immediately before the visibility change, not now mid-development. `main` keeps its
normal, real history privately in the meantime; nothing about today's ongoing development changes.

### Cross-reference cleanup

Grepped every file staying public for references into the 11 removed paths (same method as the
2026-08-19 control-plane extraction). Fixed: `README.md` (documentation index, product-discovery
and monetization mentions), `docs/deployment.md`, `docs/open-source-plan.md`,
`docs/local-monitoring-workbench.md`, `openspec/config.yaml` (the AI context primer — again the one
that mattered most, since it previously instructed future OpenSpec work to record decisions in
`docs/decisions.md`, which no longer exists here). `openspec/changes/publish-cli/{proposal,design}.md`
mention `agent-kit-download` by name in plain text (no markdown links) — left as-is, no broken
reference and no strategy content exposed. `community-boundary.md`'s classification table updated
with explicit rows for all 11 paths.

### Verification

Full local pass: `npm run typecheck`, `npm test` (102 tests), `npm run build` (webpack, same sandbox
note as above), `npm run build:cli` + `verify:cli`, `npm run build:sdk` + `verify:sdk-types`,
`npm run build:kit`, `npm run check:licenses` (269 dependencies), `npm run check:package-contents`,
`gitleaks git --log-opts="--all"` (no leaks), `npm audit --omit=dev --audit-level=high` (0
vulnerabilities), `npm run openspec:validate` (8 items, down from 12, no dangling references from
the removed change directories) — all passed. No `apps/web` source changed, so no browser
re-verification was needed.

### Still open

- `CLAUDE.md` itself instructs future agents to maintain several of the now-private files (its own
  "Documentation" section). Flagged to the owner separately — this needs its own decision (keep
  CLAUDE.md public and edit it, or exclude it too), not decided as part of this pass.
- The actual clean-root history squash (above) — deferred to final release prep by design.
