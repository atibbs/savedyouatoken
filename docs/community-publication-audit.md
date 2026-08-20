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

- The actual clean-root history squash (above) — deferred to final release prep by design.

## 2026-08-19 — CLAUDE.md added to the clean-root exclusion list

Resolves the "still open" item above. `CLAUDE.md` — the AI build-agent's operating instructions,
which mandate maintaining several of the now-private docs — is unlike the 11 paths removed today:
it's actively used for ongoing Claude Code sessions in this repository, not pure reference material.
Deleting it now (the same treatment as the other 11) would break that guidance immediately for
every future session, not just once the repository eventually goes public.

**Owner decision: `CLAUDE.md` stays fully in place and active on `main`** for ongoing development.
It's added to the same clean-root exclusion list as the strategy documents (recorded in
`community-boundary.md`'s topology section and tracked-path table) — excluded specifically from the
clean-root history commit at final release prep, not touched today. No file changes in this entry;
documentation only.

Considered and rejected: `.gitignore`. It only affects untracked files — `CLAUDE.md` has been
tracked since nearly the first commit, so adding it to `.gitignore` would have no effect on either
the working tree or history, and would not achieve exclusion from a future publication in any form.

## 2026-08-19 — non-main branch cleanup

Resolves owner checklist §3's branch-cleanup item. 28 non-`main` remote branches existed; checked
each against `git branch -r --merged origin/main` and against open PRs before touching anything:

- **24 were fully merged into `main`** — every commit they contained already exists in `main`'s
  history, so deleting the branch ref removes nothing. Deleted: `add/sdk-release`,
  `add/vercel-analytics`, `apply/agent-kit-download`, `apply/prompt-capture-sdk`,
  `apply/publish-cli`, `change/agent-kit-download`, `change/prompt-capture-sdk`,
  `change/publish-cli`, `codex/add-local-monitoring-workbench`,
  `codex/archive-cli-regression-workflow`, `codex/archive-completed-openspec-changes`,
  `codex/auto-version-bump-ci`, `codex/clarify-product-surfaces`,
  `codex/extract-private-control-plane`, `codex/improve-sdk-operations`,
  `codex/privatize-strategy-docs`, `codex/product-strategy-openspec-roadmap`,
  `codex/publish-community-source-audit-prep`, `codex/seo-foundations`,
  `codex/verify-clean-clone-builds`, `codex/version-report-policy-contracts`,
  `content/approachable-copy`, `deploy/prep`, `fix/cli-releasing-doc`.
- **4 were left alone**: `dependabot/github_actions/actions/checkout-7`,
  `dependabot/github_actions/actions/setup-node-7`,
  `dependabot/npm_and_yarn/npm-development-dependencies-d6f16f7376`,
  `dependabot/npm_and_yarn/npm-production-dependencies-3f12f1722a` — each has an open PR (#21–24).
  Deleting a branch out from under an open PR is messy (GitHub leaves the PR open but unmergeable
  rather than closing it cleanly); these need a merge-or-close decision on the PR first.

Remaining before the visibility change: resolve #21–24, then delete their branches too. Only `main`
should remain when the repository goes public — every other branch becomes publicly visible the
moment visibility changes.

### Update — #21, #22, #24 resolved; #23 held

- **#21** (`actions/checkout` v4→v7) and **#24** (`gpt-tokenizer` v2→v4, `next` patch) merged
  clean. #24's grouped update also bumped `gpt-tokenizer` inside `packages/cli/package.json` and
  `packages/sdk/package.json` directly (missed on first review, which only checked
  `apps/web`'s diff) — verified safe separately: every import in this codebase uses the explicit
  `gpt-tokenizer/encoding/o200k_base` subpath, never the default export that changed behavior in
  v3.
- **#22** (`actions/setup-node` v4→v7) needed manual conflict resolution — Dependabot's own
  auto-rebase raced with a manual rebase and briefly reverted `checkout` back to v4 in three
  workflow files. Resolved to `checkout@v7` + `setup-node@v7` consistently across all five
  workflow files, verified via `git merge-base --is-ancestor`, then merged.
  `dependabot/npm_and_yarn/npm-development-dependencies-d6f16f7376` (**#23**: TypeScript
  5.6→7, Vitest 3→4, `@types/node` 22→26) was **not** merged — TypeScript 7 (the Go-rewrite
  major version) restructured its package exports and dropped the `./bin/tsc` subpath
  `packages/sdk/scripts/emit-dts.mjs` resolves directly, breaking the SDK build. Left open;
  not something to force through as a routine bump.
- The `gpt-tokenizer` bump inside `packages/cli`/`packages/sdk` triggered
  `version-packages.yml` for the first time with real work to do (every prior run had been a
  no-op). It correctly proposed a 0.2.0→0.2.1 patch bump, but `gh pr create` **failed**:
  `GitHub Actions is not permitted to create or approve pull requests`. First real exercise of
  that code path surfaced a genuine gap — the repository's Actions settings didn't allow
  Actions to open PRs, regardless of the workflow's own `permissions:` block. Opened and merged
  that bump PR manually (own `gh` access isn't subject to the restriction), confirming
  `release.yml`/`release-sdk.yml` then failed for the same two already-known reasons as before
  (CLI: provenance requires a public source repo; SDK: unregistered trusted publisher) — nothing
  new, no partial state on npm.
- **Fixed the root cause**, with owner approval: enabled `can_approve_pull_request_reviews` via
  `PUT /repos/{owner}/{repo}/actions/permissions/workflow`, leaving `default_workflow_permissions`
  at `read` — `version-packages.yml` already declares its own narrower `permissions:` block, so
  only the specific missing capability was granted, not a broader default.
- 24 fully-merged branches deleted (matches the earlier count); `main` plus #23's branch are now
  the only ones remaining.

## 2026-08-19 — tag-based release publishing (task 4.3)

CLI and SDK releases now publish from package-scoped tags (`cli-v<version>`, `sdk-v<version>`)
instead of from every push to `main` — see `community-boundary.md`'s "Proposed publication
topology" for the full mechanism and the `workflow_dispatch` design reasoning (GITHUB_TOKEN's
anti-recursion suppression applies to tag pushes exactly like branch pushes, so the tag-creation
step dispatches the release workflow directly rather than relying on the tag-push event).

New: `scripts/tag-if-version-changed.mjs` (detects a version change between `HEAD` and `HEAD^`,
mirrors `release-gate.mjs`'s `$GITHUB_OUTPUT` convention) and
`.github/workflows/tag-releases.yml`. Modified `release.yml`/`release-sdk.yml`'s triggers from
`push: branches: [main]` to `push: tags: [...]` plus `workflow_dispatch`, and their checkout step
to build from the dispatched/pushed ref rather than always `main`. `release-gate.mjs`,
`guard-cli-release.mjs`, and the actual publish/verify steps are unchanged — this only changes
what triggers a release and from which ref, not how one is verified or published.

Verified: full local pass (typecheck, 102 tests, build, `check:licenses` at 269 dependencies,
`check:package-contents`, `gitleaks` — no leaks, `npm audit --omit=dev` — 0 vulnerabilities,
`openspec:validate` — 8 items). Confirmed via API that tag protection (rulesets) is blocked on
this plan while private, same restriction as branch protection — recorded in the owner checklist
§5. Not yet exercised end-to-end in production (no version bump has landed since this merged);
first real trigger will be the next CLI/SDK/core change.

## 2026-08-20 — community release candidate built (tasks 4.4, 5.1 partial)

Built the clean-root candidate decided on 2026-08-19. `main` and ongoing development are
completely untouched by this — the candidate lives entirely on a separate branch pushed to this
still-private repository, not installed as `main`.

### What was built

1. Refreshed the `savedyouatoken-cloud` full-history backup immediately before touching anything
   (`git clone --mirror` + `push --all`/`--tags`), verified `main`'s HEAD matches between source
   and backup (`177ec33`) via `git ls-remote`. One Dependabot working branch (#23's, previously
   force-pushed multiple times) didn't fast-forward and was left as-is — irrelevant to the
   candidate and not part of what needs backing up.
2. `git checkout --orphan community-release-candidate` from `main` at `177ec33`, removed
   `CLAUDE.md` from the index and working tree (the one addition beyond what's already absent
   from `main`'s current tree — the 11 strategy/monetization documents were deleted from `main`
   itself back on 2026-08-19 and needed no further action here), committed as a single root
   commit. Verified the diff against `main` touches nothing else: `git diff --cached main` showed
   exactly one file, `CLAUDE.md`, 785 deletions, zero other changes.
3. Pushed the branch to `origin` (this repository) rather than only leaving it local, so it's
   reviewable on GitHub — the repository is still private, so this exposes nothing publicly.

### Verification

Full pass on the candidate branch, fresh `npm install`: `npm run typecheck`, `npm test` (102
tests), `npm run build` (webpack — same sandbox-only Turbopack limitation noted in earlier
tranches), `npm run build:cli` + `verify:cli` (installed shim reports `0.2.1`, runs a full
audit/regression/workbench pass), `npm run build:sdk` + `verify:sdk-types`, `npm run build:kit`,
`npm run check:licenses` (269 dependencies), `npm run check:package-contents`,
`npm audit --omit=dev --audit-level=high` (0 vulnerabilities), `npm run openspec:validate` (8
items) — all passed. `gitleaks` run twice: once at `--log-opts="--all"` scope (67 commits across
every local branch including this new one — no leaks) and once scoped to just this branch's single
commit (`--log-opts="-1"` — no leaks). `git ls-tree -r --name-only HEAD | grep` against every
excluded path name (the 11 strategy documents, `PRIORITIES.md`, the four change directories, and
`CLAUDE.md`) returned nothing.

This satisfies task 4.4 (release candidates produced and installed via the CLI/SDK `verify:*`
scripts, which install the packed tarball into a throwaway project and exercise it end to end) and
the "re-run the complete release gate" half of task 5.1. It does not satisfy 5.1's "freeze
nonessential changes" — that's a standing commitment the owner declares and holds, not a one-time
action — nor task 2.7 (maintainer manual review), which needs the owner, not this scan, to actually
look at the candidate. `community-boundary.md`'s "Proposed publication topology" has the full
record.

### Still open before publication

- 2.6 / 2.7 — owner credential sign-off (nothing to rotate, per the scan) and manual review of this
  exact candidate.
- 5.1's freeze commitment, 5.2 (final backup/access/permissions re-confirmation), 5.3 (the
  irreversible visibility change — swapping this candidate branch in as `main` happens as part of
  this step, not before it).
- Everything downstream of 5.3 (5.4–5.6, 6.1–6.3).

## 2026-08-20 — owner checklist walkthrough, first pass

Owner worked through the checklist §2/§5 items in order:

- **§2 access and location, both resolved:** `savedyouatoken-cloud` access limited to the intended
  people; private infrastructure/deployment docs will live in `savedyouatoken-cloud`'s own `docs/`.
- **§5 private vulnerability reporting: confirmed blocked while private**, not a UI-finding
  problem. Checked directly rather than repeat an earlier wrong guess (an earlier tranche of this
  audit gave "Settings → Code security" as the navigation path, which is incorrect): GitHub's own
  docs (`docs.github.com/.../configuring-private-vulnerability-reporting-for-a-repository`)
  describe this feature only for public repositories, name the real path as Settings → **Advanced
  Security** (not the general Code security page), and `repos/{owner}/{repo}` returns zero
  security/advanced-security fields for this repo — `PUT .../private-vulnerability-reporting`
  404s outright rather than enabling anything or returning a clearer paid-feature error. Same
  class of restriction as branch protection and tag rulesets (both confirmed blocked earlier).
  Nothing to do until the repository is public or on a GHAS-eligible plan.
- **§5 dependency/secret scanning: split into two, since the checklist's single line conflated an
  actionable item with a likely-blocked one.** Dependabot *alerts* are free for private
  repositories and remain the actionable part (previously confirmed off, still open). Secret/code
  scanning is GitHub Advanced Security and is likely blocked the same way private vulnerability
  reporting is, though not yet independently confirmed via API the way the other two were.

## 2026-08-20 — Dependabot alerts enabled; GHAS scanning confirmed blocked too

Owner enabled Dependabot alerts. Verified via API: `GET repos/{owner}/{repo}/vulnerability-alerts`
now returns 204 (was 404 in the earlier tranche). Checked off in the owner checklist.

While updating that entry, also resolved the "not yet independently confirmed" note on
secret/code scanning left in the prior entry: attempted to enable each directly via the API.
Secret scanning: `PATCH repos/{owner}/{repo}` with `security_and_analysis.secret_scanning.status`
returns 422 "Secret scanning is not available for this repository." Code scanning:
`GET .../code-scanning/default-setup` 403s with "Code scanning is not enabled for this
repository. Please enable code scanning in the repository settings" (a circular message, but the
403 plus secret scanning's explicit "not available" is consistent with the same GHAS/plan
restriction already confirmed for private vulnerability reporting, branch protection, and tag
rulesets). Neither is a substitute for what this repository already runs in CI regardless
(`gitleaks` full-history secret scan and `npm audit`, task 3.4) — those aren't blocked by
anything and already cover the same ground GHAS would add, until public unlocks it too.
