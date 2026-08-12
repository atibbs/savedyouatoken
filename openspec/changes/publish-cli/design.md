## Context

See `proposal.md — Why`. Requirements are in `specs/cli-release/spec.md`. Today: `packages/cli` is
the workspace named `savedyouatoken` (v0.1.0, unpublished), bundled with tsup so the published
artifact **embeds** the pricing catalogue from `packages/core` at build time. `.github/workflows`
has only `ci.yml` (typecheck/test/build); there is no release path or `NPM_TOKEN`.

## Goals / Non-Goals

**Goals:**
- `npx savedyouatoken@latest` resolves, runs, and never quotes prices older than the repo catalogue.
- A price edit cannot merge without triggering a release (no silent staleness).
- Releases are proven by running the installed command on the exact build before it becomes `latest`.

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

**Publish is coupled to the merge, verified up front, and published once to `latest` via OIDC.** The
release runs on **push to `main`**, gated by an idempotent, monotonic check
(`scripts/release-gate.mjs`): it releases only when the CLI version is absent from npm *and*
semver-greater than the current `latest`. So a merged price bump mechanically produces a release; a
rerun after a partial failure is a no-op rather than a failed republish of an immutable version; and a
downgrade is rejected. It then builds, **verifies the packaged artifact through the installed
`savedyouatoken` shim** (see the next decision), and **publishes once, directly to `latest`, via
GitHub Actions trusted publishing (OIDC)** with automatic provenance — no stored token, and no
dist-tag promotion. Because `npm pack` is deterministic, the bytes published are the same build that
was just verified.

Rejected: a candidate dist-tag + `npm dist-tag add` promotion — dist-tag writes are **not** covered by
OIDC trusted publishing, so it would reintroduce a stored token; publishing to `latest` *without* the
up-front verification (the earlier failure mode); and gating only on `latest` (non-idempotent — a
rerun would retry an immutable version). The one residual concession vs. verifying the registry copy:
we verify the identical local build, which `npm publish` then uploads.

**Verify through the installed command, not a raw file.** Verification installs the packed tarball
into a clean project and runs npm's generated `savedyouatoken` **shim** — `--version` (asserting the
injected version) *and one real audit* — rather than invoking `dist/index.js` directly. Invoking the
file would pass even with a missing or wrong `bin` entry while the documented `npx savedyouatoken`
path fails; only exercising the shim catches that. This is the same `scripts/verify-packed-cli.mjs`
run in CI on every PR and in the release before publishing.

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
