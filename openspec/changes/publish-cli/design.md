## Context

See `proposal.md — Why`. Requirements are in `specs/cli-release/spec.md`. Today: `packages/cli` is
the workspace named `savedyouatoken` (v0.1.0, unpublished), bundled with tsup so the published
artifact **embeds** the pricing catalogue from `packages/core` at build time. `.github/workflows`
has only `ci.yml` (typecheck/test/build); there is no release path or `NPM_TOKEN`.

## Goals / Non-Goals

**Goals:**
- `npx savedyouatoken@latest` resolves, runs, and never quotes prices older than the repo catalogue.
- A price edit cannot merge without triggering a release (no silent staleness).
- Releases are proven by running the actual published artifact.

**Non-Goals:**
- Publishing `packages/core` as its own npm package (it ships as source, bundled into the CLI).
- A heavyweight release framework if a small workflow suffices.
- The kit, the `/kit` page, or anything in `agent-kit-download` (separate change that depends on this).

## Decisions

**Publish the CLI as a public package with a build-on-publish step.** Configure `packages/cli` for
publication — public access, an explicit `files` allowlist (the tsup `dist/` + `bin`), a `bin` entry,
and a `prepublishOnly` that builds the bundle — so `npm publish` always ships a fresh, catalogue-current
build. Alternative (publishing hand-built artifacts) risks shipping a stale `dist/`.

**Tie the version to the catalogue via a CI guard.** The staleness risk is structural: the CLI embeds
prices, so `@latest` is only current if republished on price changes. A CI check compares the pricing
catalogue (or its `PRICES_VERIFIED_ON` marker) against the CLI's version and **fails a PR that changes
the catalogue without bumping the version**. The guard is *necessary but not sufficient* — it only
guarantees a merged price change carries a bump; the push-triggered publish below is what turns that
bump into a shipped release. Alternatives: auto-bumping on any core change (bumps on non-price edits),
or trusting discipline (the failure mode the review caught).

**Publish is coupled to the merge, staged behind verification, and uses OIDC — not a manual tag or a
stored token.** The release runs on **push to `main`**: when `packages/cli`'s version is ahead of the
version currently on npm, the workflow publishes. A merged price bump therefore *mechanically*
produces a release, rather than waiting for someone to cut a tag — a bumped `package.json` that never
ships would otherwise leave `latest` stale (the finding). It publishes to a **candidate dist-tag**
(e.g. `rc`) first, never straight to `latest`. Authentication is **GitHub Actions trusted publishing
(OIDC, `id-token: write`)**, which needs no long-lived `NPM_TOKEN` and emits provenance automatically;
a one-time bootstrap token claims the name and configures the trusted publisher, then is revoked.
Rejected: publish-on-tag (decouples merge from release), publish-straight-to-`latest` (exposes a
broken build before verification), and a stored write token (an avoidable long-lived credential).

**Verify the registry candidate, then promote to `latest`.** After the candidate is published, a
clean job (no repo on PATH) installs `savedyouatoken@<candidate>` from npm and asserts it runs and
reports the published version. Only on success does the workflow promote that version to `latest`
(`npm dist-tag add`). A packaging bug — missing `bin`/`files`, a broken bundle, or a mismatched
version — thus fails the release **without ever exposing a broken `latest`**, which is what "verified
before trusted" actually requires. A local `npm test` never catches this class of bug.

**The CLI's reported version is single-sourced from `package.json`.** Today `src/index.ts` hard-codes
`const VERSION = '0.1.0'` independently of the package version, so a bump would publish while
`--version` still printed the old number — and the candidate smoke test's version assertion would
fail. The build injects the package version (tsup `define`, or reading `package.json` at build time),
and a test asserts the packed binary reports the tarball's version.

## Risks / Trade-offs

- **Publish credentials** → trusted publishing (OIDC) means no long-lived `NPM_TOKEN` in steady
  state; the only secret is a short-lived bootstrap token used once to claim the name and configure
  the trusted publisher, then revoked. Provenance is emitted automatically.
- **Version-bump guard false positives** (catalogue file touched cosmetically) → key the guard on the
  `PRICES_VERIFIED_ON` marker or a content hash of the price data, not the whole file.
- **First publish is manual-ish** (name claim, trusted-publisher setup) → a one-time bootstrap
  documented in the tasks; steady state is merge-and-go.
- **Bundled prices mean every price edit is a release** → accepted and intended; it is the only way
  `@latest` can honestly claim to be current.

## Open Questions

- Whether to also publish under a scoped name (`@savedyouatoken/cli`) as an alias. Does not affect the
  spec or approach; `savedyouatoken` is the documented entry point.
