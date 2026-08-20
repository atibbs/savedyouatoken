# Community publication inventory and boundary

> **Status:** Executed. This repository went public on 2026-08-20 from the clean-root history
> described below. This document remains the live record of the public/private boundary — the
> classification rules and per-path decisions here still govern new files going forward, not just
> the original publication. Last audited: 2026-08-19. The private-control-plane paths below were
> extracted on 2026-08-19 — see the
> [publication audit log](community-publication-audit.md#2026-08-19--private-control-plane-extraction-task-14).
> The product-strategy/monetization/discovery documents were separately extracted the same day —
> see [that log entry](community-publication-audit.md#2026-08-19--strategy-and-monetization-documents-extracted).

## Classification rules

- **Community** is MIT-licensed source that builds or documents local analysis, instrumentation,
  package distribution, or the public product experience.
- **Shared contract** is Community source whose compatibility is also consumed by the private
  hosted service. It remains public and versioned; private code depends on it, never the reverse.
- **Private control plane** is stateful or commercial implementation: authentication, persistence,
  entitlements, billing, customer administration, alerts, private operations, and hosted Monitor.
- **Excluded artifact** is local or generated material that must not enter the publication set.

Environment flags, unexported modules, and inactive routes are not confidentiality boundaries.

## Tracked-path inventory

The patterns below classify every path tracked at the time of this audit. A new top-level path or a
new stateful web route requires an explicit classification before merge.

| Path | Classification | Rationale or required action |
|---|---|---|
| `packages/core/src/**`, `packages/core/test/**` | Community | Deterministic engine, public fixtures, and tests. |
| `packages/core/contracts/**`, `packages/core/src/contracts.ts`, `packages/core/src/report.ts` | Shared contract | Versioned schemas, canonical vectors, migrations, and report APIs. |
| `packages/core/package.json`, TypeScript and test config | Community | Public package metadata and build configuration. |
| `packages/cli/**` | Community | Local/CI product and its release documentation. |
| `packages/sdk/**` | Community | In-process capture, adapters, privacy controls, tests, and release documentation. |
| `apps/web/app/**` except the API routes listed below | Community | Static analyser, reference, methodology, product pages, metadata, and public assets. |
| `apps/web/components/**` | Community | Static/local-first UI. `analyzer/SavedPrompts.tsx` remains public because it uses browser-local storage only. `AccountMenu.tsx` and `UpgradeButton.tsx` were extracted 2026-08-19 (see below); `layout.tsx` and `pricing/page.tsx` were edited to drop the two references into them. |
| `apps/web/lib/tokenizer.ts`, `apps/web/lib/products.ts`, `apps/web/lib/site.ts`, `apps/web/lib/limits.ts` | Community | Local analysis and public product configuration. |
| `apps/web/app/fonts/**` | Community, rights verified | Self-hosted Manrope and DM Mono, both SIL OFL-1.1; license text added at `apps/web/app/fonts/*-OFL.txt`. |
| `apps/web/package.json`, Next.js, PostCSS, TypeScript, and test config | Community | Auth.js, Drizzle, Postgres, Stripe, and the `db:generate`/`db:push` scripts were removed 2026-08-19. |
| `apps/web/.env.example` | Community | Auth, database, and Stripe variable blocks removed 2026-08-19; only the two public site variables remain. |
| `apps/web/app/api/auth/**` | Extracted 2026-08-19 | Moved to `savedyouatoken-cloud` (preserved there via the full-history backup); deleted from this repository. |
| `apps/web/app/api/billing/**` | Extracted 2026-08-19 | Moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/app/api/checkout/**` | Extracted 2026-08-19 | Moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/app/api/me/**` | Extracted 2026-08-19 | Account and entitlement endpoint; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/app/api/prompts/**` | Extracted 2026-08-19 | Server-side prompt persistence; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/app/api/stripe/**` | Extracted 2026-08-19 | Webhook implementation; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/auth.ts`, `apps/web/types/next-auth.d.ts` | Extracted 2026-08-19 | Auth.js configuration and types; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/drizzle.config.ts`, `apps/web/drizzle/**`, `apps/web/lib/db/**` | Extracted 2026-08-19 | Database configuration, migration, client, and schema; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/lib/entitlements.ts`, `apps/web/lib/stripe.ts` | Extracted 2026-08-19 | Entitlement and billing implementation; moved to `savedyouatoken-cloud`; deleted from this repository. |
| `apps/web/components/AccountMenu.tsx`, `apps/web/components/UpgradeButton.tsx` | Extracted 2026-08-19 | Account/billing UI; moved to `savedyouatoken-cloud`. The two public references into them (`layout.tsx`, `pricing/page.tsx`) now render a static, honest "not yet available" state instead. |
| `examples/**` | Community | Synthetic prompts and tool definitions; no customer data is permitted. |
| `kit/**` | Community | Agent instructions, documentation, and matching MIT license. |
| `docs/**` except the rows below | Community | Public product, architecture, methodology, and contributor documentation. |
| `docs/monetization.md`, `docs/product-discovery.md`, `docs/product-platform-strategy.md`, `docs/growth.md`, `docs/future-roadmap.md`, `docs/decisions.md` | Extracted 2026-08-19 | Product strategy, monetization, growth, discovery, roadmap, and decision-log content — owner decided this stays private rather than public, independent of the credential/secrets scan (which found nothing in any of them). Preserved via the full-history backup; not deleted, just not part of this repository's public tree going forward. |
| `openspec/**` except the rows below | Community | Requirements, designs, and decisions for shipped or shippable Community-facing work. Review future proposals before merge for private operational detail. |
| `openspec/PRIORITIES.md`, `openspec/changes/launch-developer-monitor/**`, `openspec/changes/validate-monitor-pilot/**`, `openspec/changes/expand-team-enterprise-ecosystem/**`, `openspec/changes/agent-kit-download/**` | Extracted 2026-08-19 | Same reasoning as the docs row above — Monitor/enterprise/pilot business planning and the kit's monetization-experiment reasoning. `agent-kit-download`'s resulting *feature* (the `/kit` page and CTAs, `kit/` source) stays public; only the strategy spec explaining why it exists this way moved. |
| `.github/workflows/**` | Community | CI and protected package releases; release credentials must use OIDC. |
| `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml` | Community | Contributor entry points and dependency maintenance. |
| `.claude/commands/**`, `.claude/skills/**`, `.claude/launch.json` | Community | Development workflow instructions; verify they contain no local paths or credentials. |
| `CLAUDE.md` | Excluded at clean-root (deferred) | The AI build-agent's operating instructions — Mission, Autonomy, Repository Boundaries, and a "Documentation" section that mandates maintaining several of the now-private docs above. Owner decided (2026-08-19) it stays fully in place and active on `main` for ongoing Claude Code sessions in this repository, but is excluded specifically from the clean-root history commit at final release prep — same mechanism and same timing as the strategy documents, not removed today. |
| `scripts/**` | Community | Build, package-content, and release verification. |
| `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md`, `SUPPORT.md` | Community | Public project entry points. |
| `package.json`, `package-lock.json`, `.gitignore` | Community | Reproducible workspace and publication exclusions. |

## Excluded and generated paths

The following are not tracked and must remain outside the publication set:

- `.env`, `.env.local`, and `.env.*.local`;
- `node_modules/`, `.next/`, `out/`, `dist/`, `coverage/`, and `*.tsbuildinfo`;
- `.vercel/`, `.DS_Store`, logs, and npm debug logs;
- `.claude/settings.local.json` and other machine-local editor or agent settings; and
- `kit-dist/` and package tarballs, which must be regenerated and inspected in CI.

The current working tree has no tracked package tarballs or kit archives. The tracked font files and
SVG icon remain subject to the redistribution audit.

## Repository crossings after extraction

The public repository owns report, baseline, and policy schemas and their compatibility logic under
`packages/core/contracts`. The private service may consume released versions of those contracts.
Community packages must not import the private repository, use a private registry, or require hosted
credentials. Data transfer to a future hosted service must be an explicit public adapter using the
versioned, prompt-free report contract.

## Proposed publication topology

- **Decided 2026-08-19: publish a clean-root history, not `main`'s real ancestry.** The strategy,
  monetization, and discovery documents extracted above were present from this repository's first
  commit onward, so deleting them today only removes them going forward — every past commit
  remains inspectable and would still show their full content if the real history were published.
  The owner decided that content must not be publicly visible in any form, which real-ancestry
  publication cannot satisfy. The full real history (including these documents) remains permanently
  preserved in the private `savedyouatoken-cloud` backup; nothing is lost, only not published.
  `CLAUDE.md` joins the same exclusion list (owner decision, 2026-08-19) — it stays fully active
  on `main` for ongoing development.

  **Executed 2026-08-20.** The `community-release-candidate` branch (a single history-free
  commit — `main`'s exact tree, minus `CLAUDE.md`, no parent commits) was rebuilt fresh from
  `main` immediately before publication to include everything merged since the design decision,
  re-verified in full, then force-pushed onto `main` (`git push --force origin
  community-release-candidate:main`) **while the repository was still private** — a fully
  reversible step at the time, since nothing was yet exposed and the real history remained
  recoverable from the `savedyouatoken-cloud` backup. Only after `main` was confirmed correct
  (protected CI passed independently on the new `main`, including the full secret/license/
  package-content scan) did the repository's visibility change to public. See the
  [2026-08-20 audit log entries](community-publication-audit.md) for the complete record,
  including the final pre-swap backup verification.
- The repository has no tags predating publication; `cli-v0.2.1` was tagged and released
  immediately after going public, proving the tag-based pipeline end to end with real npm
  provenance for the first time. No submodules or Git LFS objects.
- Non-`main` remote branches: resolved before publication per the owner checklist §3 branch
  cleanup (24 merged branches deleted 2026-08-19); the one exception, an open Dependabot PR
  branch, remains and is now simply public along with everything else, which is fine — it never
  contained anything sensitive.
- **Implemented 2026-08-19 (task 4.3):** CLI and SDK releases now publish from package-scoped
  tags (`cli-v<version>`, `sdk-v<version>`) rather than from every push to `main`.
  `.github/workflows/tag-releases.yml` tags the exact commit a version bump lands on and
  dispatches `release.yml`/`release-sdk.yml` via `workflow_dispatch` (not the tag-push event
  itself — GitHub's GITHUB_TOKEN anti-recursion protection suppresses that the same way it
  suppresses branch pushes; `workflow_dispatch` is the documented exemption). A maintainer can
  also push a `cli-v*`/`sdk-v*` tag by hand as an independent trigger. `cli-v0.2.1` proved the
  full pipeline for the first time on 2026-08-20, immediately after publication — real OIDC
  publish, real SLSA provenance, verified installable from the registry. Tag *protection*
  (rulesets restricting who can create/delete `cli-v*`/`sdk-v*`) is now configurable — confirmed
  unblocked the moment the repository went public (`rulesets` no longer 403s) — but not yet
  configured; the specific rules (required reviewers, which checks are required) are an owner
  decision, not something to set unilaterally. See the owner checklist §5.
- Publish only verified CLI and SDK npm tarballs plus the generated agent-kit archive. Build output,
  local archives, workflow logs, and deployment state are not source-release artifacts.

## Approval and change control

Approval of the pull request containing this inventory records the initial maintainer classification.
That approval is not the final publication approval. Before visibility changes, the maintainer must
review the exact fresh clone, its complete history, remaining branches and tags, asset rights, scan
results, and the private-repository backup.
