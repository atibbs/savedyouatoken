# Releasing the CLI

`npx savedyouatoken@latest` is a launcher used by the agent kit, the agent skill, and the site.
Because the CLI **bundles the pricing catalogue at build time**, `latest` is only trustworthy if a
new version ships whenever the catalogue changes. Two mechanisms keep that true:

- **Staleness guard** (`scripts/guard-cli-release.mjs`, wired into CI on pull requests): a PR that
  edits `packages/core/src/models.ts` fails unless it also bumps `packages/cli` `version`.
- **Release on merge** (`.github/workflows/release.yml`): on push to `main`, a gate decides whether
  to release; if so, the exact built artifact is verified through the installed `savedyouatoken`
  shim and then **published in one step to `latest` via OIDC** (no stored token, no dist-tag
  promotion). A build that fails verification is never published, so `latest` is never broken.

## Steady state (every release)

1. Change prices in `packages/core/src/models.ts` (and bump `PRICES_VERIFIED_ON`).
2. Bump `packages/cli/package.json` `version` in the same PR (the guard enforces this).
3. Merge. The workflow verifies and publishes automatically. The gate is **idempotent** (an
   already-published version is skipped) and **monotonic** (the version must be greater than the
   current `latest`), so a rerun after a partial failure is safe.

The CLI's reported `--version` is injected from `package.json` at build time (tsup `define`), so it
can never disagree with the published version; `scripts/verify-packed-cli.mjs` installs the packed
tarball and asserts it through the shim, running one real audit as well.

## One-time bootstrap (operator action — needs an npm account)

Trusted publishing cannot be configured until the package exists, so the **first** publish uses a
short-lived token — but it follows the same verify-first flow, never a plain publish.

1. **Pack once, verify, then publish that tarball.** From a clean checkout, with a short-lived
   npm **automation token** (or `npm login`):
   ```bash
   npm ci
   npm run build:cli
   TARBALL=$(npm pack --workspace savedyouatoken --silent | tail -1)
   node scripts/verify-packed-cli.mjs "$TARBALL"   # installs & runs the shim + a real audit
   npm publish "$TARBALL" --provenance --access public
   ```
   Verifying and publishing the same tarball guarantees the published bytes are exactly the ones
   verified. This claims the `savedyouatoken` name and publishes the verified `0.x` to `latest`.
2. **Configure trusted publishing.** On npmjs.com → the package → *Settings → Trusted Publisher*,
   add this GitHub repository and the `Release CLI` workflow (`.github/workflows/release.yml`).
3. **Revoke the bootstrap token.** From then on the workflow publishes via OIDC with no stored
   credential; every subsequent release is fully tokenless.
