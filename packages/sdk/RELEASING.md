# Releasing the SDK

`@savedyouatoken/sdk` is published to npm and installed as a pinned dependency in a consumer's
own project. Two properties matter at release time:

- **It bundles `@savedyouatoken/core` at build time** (tsup `noExternal`), so a published version
  carries a frozen copy of the analysis engine *and the pricing catalogue*. The dollar figures it
  reports are only as fresh as the last release.
- **Its published declarations must be self-contained.** Core ships TypeScript source and is never
  published, so the `.d.ts` cannot reference it; `scripts/emit-dts.mjs` inlines core's types and
  makes every relative specifier NodeNext-safe, and `scripts/verify-packed-types.mjs` proves it by
  type-checking a clean `NodeNext` consumer against the packed tarball with `skipLibCheck` off.

## Steady state (every release)

1. Make your change (API, adapters, or a deliberate catalogue refresh — see below).
2. Bump `packages/sdk/package.json` `version`.
3. Merge to `main`. `.github/workflows/release-sdk.yml` then, in one gated run:
   - decides whether to release (`scripts/release-gate.mjs @savedyouatoken/sdk packages/sdk`);
   - builds, **packs once**, verifies *that exact tarball* through the clean NodeNext consumer;
   - publishes the verified tarball straight to `latest` via OIDC trusted publishing.

The gate is **idempotent** (an already-published version is skipped) and **monotonic** (the
version must be semver-greater than the current `latest`), so a rerun after a partial failure is
safe, and merging without a version bump publishes nothing.

### On the bundled pricing catalogue

Unlike the CLI — which is invoked live via `npx savedyouatoken@latest` and therefore has a CI
staleness guard forcing a version bump whenever `packages/core/src/models.ts` changes — the SDK is
a **pinned** dependency, so a stale catalogue in an old version is the consumer's choice to upgrade,
like any library. A core price change therefore does **not** force an SDK release. When prices move
materially, cut a normal SDK release (bump `version`, merge) so consumers can pick it up; there is
no automated coupling to enforce here, by design.

## One-time bootstrap (operator action — needs an npm account)

Trusted publishing cannot be configured until the package exists, so the **first** publish uses a
short-lived token — but it follows the same verify-first flow, never a plain publish.

1. **Pack once, verify, then publish that tarball.** From a clean checkout, authenticated with a
   short-lived **granular access token** (read/write scope access, "bypass 2FA" enabled — the
   legacy *automation* tokens were removed in November 2025), or an interactive `npm login`:
   ```bash
   npm ci
   npm run build:sdk
   TARBALL=$(npm pack --workspace @savedyouatoken/sdk --silent | tail -1)
   node packages/sdk/scripts/verify-packed-types.mjs "$TARBALL"   # clean NodeNext consumer
   npm publish "$TARBALL" --access public
   ```
   Verifying and publishing the same tarball guarantees the published bytes are exactly the ones
   verified. This claims the `@savedyouatoken/sdk` name and publishes the verified `0.x` to `latest`.
   Note: no `--provenance` here — provenance can only be generated from CI (OIDC), so the one-time
   local bootstrap omits it; every automated release afterwards (the workflow) publishes with it.
2. **Configure trusted publishing.** On npmjs.com → the package → *Settings → Trusted Publisher*,
   add this GitHub repository and, in the **Workflow filename** field, enter just `release-sdk.yml`
   (the bare filename, **not** the `.github/workflows/…` path — a path mismatch makes the OIDC
   publish fail with `ENEEDAUTH`).
3. **Revoke the bootstrap token.** From then on the workflow publishes via OIDC with no stored
   credential; every subsequent release is fully tokenless.
