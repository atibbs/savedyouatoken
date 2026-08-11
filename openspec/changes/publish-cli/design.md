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
catalogue (or its `PRICES_VERIFIED_ON` marker) against the CLI's published version and **fails a PR
that changes the catalogue without bumping the version**. This makes "you changed prices, cut a
release" a merge gate rather than a hope. Alternatives considered: fully auto-bumping on any core
change (surprising, and bumps on non-price edits), or trusting discipline (the exact failure mode the
review caught).

**Release on version tag via a GitHub Actions workflow, using `NPM_TOKEN`.** A `release.yml` triggers
on a semver tag (or a release event): it builds, publishes with provenance, then runs the smoke test.
Keeping publish on an explicit tag keeps releases intentional and auditable; the CI guard above is
what ensures a price change is *accompanied* by that tag. Alternative — publish on every main push —
is noisier and risks accidental releases.

**Verify by running the published artifact, not the local build.** The smoke test does
`npx savedyouatoken@<version>` in a clean job (no repo checkout on PATH) and asserts it runs and
prints the version. This catches packaging mistakes (missing `bin`, missing `files`, broken bundle)
that a local `npm test` never sees — the class of bug that makes an installed kit fail.

## Risks / Trade-offs

- **`NPM_TOKEN` is a real secret** → stored as a CI secret, never committed; use a granular
  automation token scoped to publish. Provenance publishing (`--provenance`) adds supply-chain
  integrity.
- **Version-bump guard false positives** (catalogue file touched cosmetically) → key the guard on the
  `PRICES_VERIFIED_ON` marker or a content hash of the price data, not the whole file.
- **First publish is manual-ish** (name claim, 2FA/token setup) → a one-time bootstrap documented in
  the tasks; steady state is tag-and-go.
- **Bundled prices mean every price edit is a release** → accepted and intended; it is the only way
  `@latest` can honestly claim to be current.

## Open Questions

- Whether to also publish under a scoped name (`@savedyouatoken/cli`) as an alias. Does not affect the
  spec or approach; `savedyouatoken` is the documented entry point.
