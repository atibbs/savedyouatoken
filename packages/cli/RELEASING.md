# Releasing the CLI

`npx savedyouatoken@latest` is a launcher used by the agent kit, the agent skill, and the site.
Because the CLI **bundles the pricing catalogue at build time**, `latest` is only trustworthy if a
new version ships whenever the catalogue changes. Two mechanisms keep that true:

- **Staleness guard** (`scripts/guard-cli-release.mjs`, wired into CI on pull requests): a PR that
  edits `packages/core/src/models.ts` fails unless it also bumps `packages/cli` `version`.
- **Release on merge** (`.github/workflows/release.yml`): on push to `main`, if the CLI version is
  ahead of npm, it is published to a candidate tag, verified from the registry, and only then
  promoted to `latest`.

## Steady state (every release)

1. Change prices in `packages/core/src/models.ts` (and bump `PRICES_VERIFIED_ON`).
2. Bump `packages/cli/package.json` `version` in the same PR (the guard enforces this).
3. Merge. The release workflow publishes the new version and promotes it to `latest` automatically.

The CLI's reported `--version` is injected from `package.json` at build time (tsup `define`), so it
can never disagree with the published version. `scripts/verify-packed-cli.mjs` asserts this.

## One-time bootstrap (operator action — needs an npm account)

This cannot be done from CI alone; it requires an npm account and repo admin.

1. **Claim the name.** From a clean checkout, `cd packages/cli && npm publish --access public` once,
   authenticated with a short-lived npm **automation token** (or `npm login`). This reserves
   `savedyouatoken` and creates the first version.
2. **Configure trusted publishing.** On npmjs.com → the package → *Settings → Trusted Publisher*, add
   this GitHub repository and the `Release CLI` workflow (`.github/workflows/release.yml`). This lets
   the workflow publish via **OIDC** with no stored token, and emits provenance automatically.
3. **Revoke the bootstrap token.** Once trusted publishing works, delete the automation token used in
   step 1 — steady state stores no long-lived write credential.

### Note on the promote step

`npm publish` under trusted publishing is covered by OIDC. If `npm dist-tag add` (the promote step)
is not covered in your npm version, scope a **granular automation token limited to this one package**
for that step only — never a broad write token. Prefer the OIDC path once supported end-to-end.
