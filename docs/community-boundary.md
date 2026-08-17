# Community publication inventory and boundary

> **Status:** Proposed publication inventory, reviewed through the pull request that introduces
> this document. It records the intended public/private split; it does not authorize changing
> repository visibility. Last audited: 2026-08-13.

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
| `apps/web/components/**` except `AccountMenu.tsx` and `UpgradeButton.tsx` | Community | Static/local-first UI. `analyzer/SavedPrompts.tsx` remains public because it uses browser-local storage only. |
| `apps/web/lib/tokenizer.ts`, `apps/web/lib/products.ts`, `apps/web/lib/site.ts`, `apps/web/lib/limits.ts` | Community | Local analysis and public product configuration. Remove hosted-tier wording from `limits.ts` consumers if it stops matching Community behaviour. |
| `apps/web/app/fonts/**` | Community, rights gate pending | Self-hosted Manrope and DM Mono files stay only after redistribution rights are verified in the asset audit. |
| `apps/web/package.json`, Next.js, PostCSS, TypeScript, and test config | Community after extraction | Remove Auth.js, Drizzle, Postgres, Stripe, database scripts, and other private-only dependencies. |
| `apps/web/.env.example` | Split | Keep public site variables; move auth, database, and Stripe variables to the private repository. |
| `apps/web/app/api/auth/**` | Private control plane | Move to `savedyouatoken-cloud`. |
| `apps/web/app/api/billing/**` | Private control plane | Move to `savedyouatoken-cloud`. |
| `apps/web/app/api/checkout/**` | Private control plane | Move to `savedyouatoken-cloud`. |
| `apps/web/app/api/me/**` | Private control plane | Account and entitlement endpoint; move to `savedyouatoken-cloud`. |
| `apps/web/app/api/prompts/**` | Private control plane | Server-side prompt persistence; move to `savedyouatoken-cloud`. |
| `apps/web/app/api/stripe/**` | Private control plane | Move webhook implementation to `savedyouatoken-cloud`. |
| `apps/web/auth.ts`, `apps/web/types/next-auth.d.ts` | Private control plane | Move Auth.js configuration and types. |
| `apps/web/drizzle.config.ts`, `apps/web/drizzle/**`, `apps/web/lib/db/**` | Private control plane | Move database configuration, migration, client, and schema. |
| `apps/web/lib/entitlements.ts`, `apps/web/lib/stripe.ts` | Private control plane | Move entitlement and billing implementation. |
| `apps/web/components/AccountMenu.tsx`, `apps/web/components/UpgradeButton.tsx` | Private control plane | Move account/billing UI; replace public references with Monitor-neutral calls to action. |
| `examples/**` | Community | Synthetic prompts and tool definitions; no customer data is permitted. |
| `kit/**` | Community | Agent instructions, documentation, and matching MIT license. |
| `docs/**` | Community | Public product, architecture, methodology, and contributor documentation. Commercial notes require sensitive-content review before publication. |
| `openspec/**` | Community | Public roadmap, requirements, designs, and decisions. Review future proposals before merge for private operational detail. |
| `.github/workflows/**` | Community | CI and protected package releases; release credentials must use OIDC. |
| `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml` | Community | Contributor entry points and dependency maintenance. |
| `.claude/commands/**`, `.claude/skills/**`, `.claude/launch.json`, `CLAUDE.md` | Community | Development workflow instructions; verify they contain no local paths or credentials. |
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

- Publish `main` and its reviewed ancestry only.
- The repository currently has no tags, submodules, or Git LFS objects.
- Archive private backups outside the public repository, then remove all non-`main` remote branches
  before changing visibility; changing a repository to public exposes every remaining branch.
- Create future Community releases from protected `v*` tags on reviewed `main` commits.
- Publish only verified CLI and SDK npm tarballs plus the generated agent-kit archive. Build output,
  local archives, workflow logs, and deployment state are not source-release artifacts.
- If the full `main` ancestry fails the history audit, publish a reviewed clean-root history instead
  and retain the original repository privately as the recovery archive.

## Approval and change control

Approval of the pull request containing this inventory records the initial maintainer classification.
That approval is not the final publication approval. Before visibility changes, the maintainer must
review the exact fresh clone, its complete history, remaining branches and tags, asset rights, scan
results, and the private-repository backup.
