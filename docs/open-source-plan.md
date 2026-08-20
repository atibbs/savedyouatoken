# Open-source transition plan

> **Status:** Complete. The repository went public on 2026-08-20, from a reviewed clean-root
> history — see [`docs/community-publication-audit.md`](community-publication-audit.md) for the
> full record. This document is kept as the historical record of the plan that was executed and
> the boundary rules that remain in force going forward, not as a forward-looking plan.

## Decision

Open-source the local analysis and instrumentation layer of savedyouatoken under the MIT license.
Keep the hosted, stateful control plane commercially operated and its implementation private unless
there is a later, explicit reason to change that boundary.

The durable product boundary is:

> **Open analysis and instrumentation; paid operational control.**

This supports the product strategy already established privately: the free products diagnose and
prevent waste locally, while Monitor earns revenue by remembering, comparing, coordinating, and
alerting.

## Why open source fits this product

savedyouatoken asks developers to run code against commercially sensitive prompts and to wrap
production model clients. Public source makes the privacy and safety claims inspectable instead of
asking users to accept them on trust. It also makes adoption through npm, CI, agent workflows, and
framework integrations easier.

The analysis engine itself is not the strongest long-term commercial moat. The harder recurring
product is the operational loop around it: retained history, trusted baselines, release comparisons,
regression alerts, ownership, collaboration, governance, and support. Opening the local layer makes
that layer easier to adopt without giving away the hosted service's primary value.

Open source should therefore be treated as a distribution and trust strategy, not as the business
model by itself.

## Public and private boundaries

### Public Community repository

The public `savedyouatoken` repository should contain:

- the deterministic analysis engine in `packages/core`;
- the `savedyouatoken` CLI in `packages/cli`;
- the `@savedyouatoken/sdk` runtime instrumentation package in `packages/sdk`;
- the local-first web analyser and public product/documentation pages;
- the agent kit and its guard tests;
- shared, versioned report and policy schemas;
- examples, tests, release workflows, and contributor documentation; and
- documentation explaining methodology, privacy, limitations, and supported integrations.

These components should remain useful without an account, hosted API, or paid subscription.

### Private commercial repository

A separate private repository—provisionally `savedyouatoken-cloud`—should contain the hosted
control-plane implementation, including:

- report ingestion and durable storage;
- workflow history and production baselines;
- release and deployment comparisons;
- alerts and notification integrations;
- team workspaces, ownership, RBAC, and audit logs;
- authentication, entitlements, billing, and customer administration;
- private-networking and enterprise deployment code; and
- internal operations, support, and infrastructure configuration.

Public packages may define stable interfaces for these features, but should not require the private
repository to build, test, or deliver their local value.

### Code that must be separated before publication

The monorepo used to include dormant hosted-product boundaries — Auth.js routes, database schema
and migrations, entitlement logic, Stripe helpers, billing routes, and a webhook. These have moved
to the private `savedyouatoken-cloud` repository (see `docs/community-boundary.md` and the
`publish-community-source` audit log); before the repository becomes public, confirm no new file
introduces the same kind of boundary without an explicit choice:

1. move commercial control-plane implementation to `savedyouatoken-cloud`;
2. retain only a public client contract, schema, or adapter when interoperability requires it; or
3. deliberately open-source the implementation and record why doing so does not weaken the
   commercial boundary.

The default is to move stateful service implementation private. Do not rely on an unexported module,
disabled environment flag, or unpublished route as a confidentiality boundary in a public repo.

## Publication plan

### Phase 0 — keep the claim accurate

Until the repository is public:

- say **“MIT-licensed source planned for public release”** or **“planned to become open source”**;
- do not display an “open source” badge or claim that users can inspect the full source;
- keep the existing npm package descriptions accurate about where source can be accessed; and
- track the public-release work as a launch prerequisite, not an implied property of the license.

### Phase 1 — define and extract the boundary

1. Inventory every package, web route, database migration, workflow, deployment file, and document.
2. Mark each item `public`, `private`, or `shared contract` using the boundary above.
3. Create the private control-plane repository.
4. Move hosted authentication, persistence, entitlements, billing, and future Monitor code there.
5. Replace cross-repository imports with versioned public contracts where necessary.
6. Confirm the public repository builds and all free surfaces work without private code or secrets.

This phase is complete only when a fresh contributor can install, test, and run the public project
without access to private infrastructure.

### Phase 2 — perform a publication safety audit

Audit both the current tree and the complete Git history. At minimum, check for:

- API keys, tokens, credentials, cookies, signing secrets, and private keys;
- `.env` files or secrets embedded in examples, fixtures, logs, screenshots, and build artifacts;
- customer prompts, production reports, personal data, internal URLs, and account identifiers;
- proprietary third-party assets, fonts, datasets, or copied code without redistribution rights;
- internal commercial notes that should not become permanent public history;
- package tarballs, build output, local settings, and other accidental artifacts; and
- dependency licenses incompatible with MIT redistribution.

If a secret ever entered history, remove it from the history **and rotate or revoke it**. Rewriting
history alone does not make a credential safe. Have a human review the final publication diff and a
fresh clone before changing repository visibility.

### Phase 3 — make the repository contributor-ready

Add or verify:

- `LICENSE` with the correct copyright holder and year;
- `CONTRIBUTING.md` with setup, tests, scope, and pull-request expectations;
- `CODE_OF_CONDUCT.md`;
- `SECURITY.md` with a private vulnerability-reporting channel and support window;
- issue and pull-request templates;
- a maintainer or governance statement explaining who makes final decisions;
- package-level READMEs, public repository links, and changelogs;
- CI for builds, tests, linting, package contents, and agent-kit integrity;
- automated dependency and secret scanning; and
- an explicit support boundary between Community and paid offerings.

The contribution guide should state that accepting a contribution does not guarantee a feature,
integration, release date, or hosted-service capability. Start without a contributor license
agreement; MIT inbound contributions accepted through the normal pull-request process are adequate
until legal or partnership needs demonstrate otherwise.

### Phase 4 — prepare a reproducible public release

1. Produce clean npm package tarballs and inspect their contents.
2. Ensure `package.json` metadata points to the public repository, issue tracker, documentation, and
   MIT license.
3. Verify the CLI and SDK can be built from the tagged source using documented commands.
4. Run the complete test suite from a fresh clone with no maintainer-only environment variables.
5. Verify source maps, declaration files, and distributed packages do not expose private code or
   local filesystem paths.
6. Create a release candidate tag and test installation by exact version.
7. Prepare release notes that explain what is open, what remains a hosted product, and how security
   reports are handled.

### Phase 5 — publish deliberately

1. Freeze nonessential changes during the final audit.
2. Back up the private repository and confirm branch-protection settings.
3. Change the Community repository visibility to public.
4. Publish or verify matching CLI and SDK releases from the public tag.
5. Update savedyouatoken.com, npm metadata, and documentation to say **“open source under MIT.”**
6. Announce the project with one clear contribution path and several bounded starter issues.
7. Monitor vulnerability reports, installation failures, package provenance, and support load during
   the launch window.

Do not combine repository publication with the first launch of paid Monitor. Separating the events
makes failures easier to diagnose and keeps the open-source launch focused on trust and adoption.

### Phase 6 — operate the project in public

- publish a lightweight roadmap while preserving freedom to change priorities;
- label issues by scope and whether maintainers intend to support them;
- release security fixes promptly and document supported versions;
- keep report and policy schemas backward-compatible or version them explicitly;
- require tests and review for changes to token counting, pricing, rewrite safety, and capture paths;
- publish releases from protected CI with npm provenance where supported;
- acknowledge material contributors; and
- review the public/private boundary whenever a feature spans Community and Monitor.

## Release gate

The repository is ready to become public only when every item below is true:

- [ ] Public/private inventory is approved.
- [ ] Hosted control-plane implementation is removed or deliberately approved for publication.
- [ ] The working tree and complete Git history pass secret and sensitive-data review.
- [ ] Any exposed credentials are revoked or rotated.
- [ ] Third-party code, assets, datasets, and dependency licenses pass redistribution review.
- [ ] A fresh clone builds and tests without private dependencies or maintainer credentials.
- [ ] CLI, SDK, web analyser, and agent kit documentation match their actual package boundaries.
- [ ] `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` are present.
- [ ] Repository, issue tracker, and license metadata are correct in every published package.
- [ ] CI, branch protection, release permissions, and npm publishing provenance are configured.
- [ ] Website wording accurately distinguishes Community software from hosted Monitor.
- [ ] A maintainer has reviewed the exact repository and history that will become public.

## Product and website language

After publication, recommended language is:

> savedyouatoken's analysis engine, CLI, runtime SDK, web analyser, and agent kit are open source under
> MIT. savedyouatoken Monitor adds hosted history, comparisons, alerts, and team controls.

Avoid using “open core” as the primary customer-facing description until Monitor exists and the term
helps rather than confuses buyers. Explain the practical boundary instead:

- **Community:** inspect, run, automate, and self-integrate the analysis locally;
- **Monitor:** retain results, compare deployments, coordinate teams, and receive regressions.

The `/sdk`, `/cli`, and `/kit` pages should link to the corresponding public source directories. The
site footer should link to the public repository, license, contribution guide, and security policy.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Sensitive history becomes public | Scan the full history, rotate exposed credentials, and use a clean-history publication only when necessary and transparently documented. |
| Users expect free hosted features | State that MIT covers the software, not hosted infrastructure, retention, support, or service commitments. |
| The public/private split creates duplicated logic | Keep analysis and schemas public; keep the private repository focused on state and operations. |
| Contributions increase maintainer load | Publish scope, use issue templates, label supported work, and promise no response SLA for Community. |
| A fork competes with the hosted product | Compete on reliable operations, workflow, integrations, trust, and support rather than restricting the local engine. |
| Public findings expose correctness or security defects | Treat discoverability as a benefit; provide a private security channel and a disciplined fix/release process. |
| Package source and repository releases drift | Release packages from protected public tags and verify tarball contents in CI. |

## Success measures

Open source is working if it improves trusted adoption rather than merely producing repository stars.
Track:

- CLI and SDK installs that progress to successful analysis;
- repositories adding CI budgets or policy files;
- SDK retention through multiple application releases;
- useful external issues, integrations, and merged contributions;
- time from first install to a measured saving;
- users who move from local analysis to repeated comparisons; and
- qualified Monitor pilot requests attributable to Community adoption.

Stars, forks, and launch traffic are useful reach indicators but are not proof of recurring product
value.

## Revisit conditions

Reconsider the boundary if customers repeatedly require self-hosting, if maintaining two
repositories materially slows delivery, or if an open control plane becomes a stronger distribution
advantage than a proprietary one. Any change should preserve the core promise that local analysis
remains inspectable and useful without a hosted account.
