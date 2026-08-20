# Draft release notes — Community source publication

> **Status:** Draft, prepared ahead of publication (task 4.5 of `publish-community-source`). This
> is not yet accurate: it describes the repository as it will read once the remaining release gates
> in [`community-publication-audit.md`](community-publication-audit.md) pass and visibility changes.
> Do not post this anywhere public, and do not change any product page from "planned" to
> present-tense open-source language, until [`community-publication-owner-checklist.md`](community-publication-owner-checklist.md)
> is fully signed off — that document, not this one, is authoritative about what has actually
> happened. Update the version, date, and links below at the actual release; the rest should not
> need major changes.

---

## savedyouatoken Community — public source, v0.1.0

`savedyouatoken` — the deterministic prompt-cost analyser, CLI, and runtime SDK — is now
MIT-licensed public source. Anyone can clone it, read exactly how the token-waste findings and
pricing math are computed, run the full test suite, and build the packages that ship to npm.

### What's in this release

- **The analysis engine** (`@savedyouatoken/core`) — the deterministic rule set, token accounting,
  and report/baseline/policy contracts behind every surface below. No network calls, no telemetry.
- **The web analyser** — the static, account-free tool at savedyouatoken.com. Paste a prompt, get
  ranked waste findings priced in dollars per month, a rewritten prompt, and cross-model cost
  comparisons. Runs entirely in your browser; your prompt never leaves the page.
- **The CLI** (`savedyouatoken`, `npx savedyouatoken`) — audits prompt files locally or in CI,
  including a discover → baseline → compare → policy regression workflow and a `--max-tokens` budget
  gate for pull requests.
- **The runtime SDK** (`@savedyouatoken/sdk`) — in-process capture of the fully assembled request a
  live application actually sends, with Anthropic and OpenAI adapters and configurable sinks.
- **The agent kit** — instructions that let a coding agent invoke the CLI against a repository's own
  prompt files.
- **The local monitoring workbench** — a `savedyouatoken workbench` subcommand that stores imported
  reports on your own disk (`~/.savedyouatoken/workbench` by default) and serves a local dashboard
  for trend, baseline, and policy history. No account, no server-side storage, nothing leaves your
  machine.

### What is *not* in this release

The hosted product surfaces — accounts, saved-prompt history behind a login, entitlements, billing,
and a managed **Monitor** service that would track cost regressions for you without you running your
own workbench — live in a separate private repository (`savedyouatoken-cloud`) and are not part of
this source release. See [`community-boundary.md`](community-boundary.md) for the exact classification
of every path, and [`community-development.md`](community-development.md) for the architecture
boundary between the two.

This split is not a bait-and-switch: everything in the free product today — the web analyser, CLI,
SDK, and local workbench — works fully without an account, without a subscription, and without any
of the private repository's code. The private repository exists because a hosted Monitor needs
durable multi-user storage, authentication, and billing, which are legitimately different concerns
from a local analysis engine, not because any part of today's free functionality was held back.

### Why publish source now

The tool inspects prompts that may contain sensitive business logic, and it wraps calls to
production model providers. A closed-source "trust us" posture is a weak answer to "does this
actually run locally, or does my prompt go somewhere?" Publishing the engine, CLI, and SDK source
lets anyone verify that claim directly instead of taking it on faith.

### Contributing

The project accepts contributions under MIT via pull request; see
[`CONTRIBUTING.md`](../CONTRIBUTING.md) for the workflow and [`GOVERNANCE.md`](../GOVERNANCE.md) for
maintainer authority and how decisions get made. Support is issue-based and best-effort — see
[`SUPPORT.md`](../SUPPORT.md); there is no support SLA for the Community repository.

Before opening a pull request that touches the analysis engine, CLI, or SDK, run:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run build:cli && npm run verify:cli
npm run build:sdk && npm run verify:sdk-types
```

### Security

Report suspected vulnerabilities privately through a GitHub Security Advisory rather than a public
issue — see [`SECURITY.md`](../SECURITY.md) for scope, supported versions, and what not to include in
a report (real prompts, credentials, or customer data). Every release of the CLI and SDK is built and
published from protected CI using npm trusted publishing (OIDC) with provenance, directly from the
exact commit and tag under review — nothing is published from a maintainer's laptop.

### Compatibility

The `report`, `baseline`, and `policy` JSON contracts under `packages/core/contracts` are versioned
and are the only interface the private hosted service is allowed to depend on; Community source never
depends on the private repository, a private registry, or hosted credentials in the other direction.
See [`contracts.md`](contracts.md).
