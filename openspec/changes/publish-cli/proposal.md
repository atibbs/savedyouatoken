## Why

The whole "launcher, not snapshot" strategy — the basis for the `agent-kit-download` change and the
free agent-skill on the roadmap — assumes `npx savedyouatoken@latest` resolves and reflects current
prices. It does neither today: `npm view savedyouatoken` returns E404 (never published) and there is
no release workflow. And because the CLI **bundles** the pricing catalogue at build time, publishing
once is not enough — `@latest` is only "always current" if it is **republished when prices change**.
Without this, anything that tells a user to run the CLI ships broken or stale.

## What Changes

- **Publish the `savedyouatoken` CLI to npm** so `npx savedyouatoken@latest` resolves and runs.
- **A release process** that publishes a new version whenever the pricing catalogue in
  `packages/core` changes, so the npm `latest` tag never lags the prices the tool quotes.
- **A staleness guard**: CI fails if the catalogue changed without a corresponding version bump, so a
  price edit cannot merge without triggering a release.
- **A post-publish smoke test** that runs `npx savedyouatoken@latest` from a clean environment and
  confirms it executes and reports a version.

## Capabilities

### New Capabilities
- `cli-release`: publishing the CLI to npm and keeping the published `latest` current with the pricing
  catalogue, so `npx savedyouatoken@latest` is a trustworthy always-current launcher.

### Modified Capabilities
<!-- None. This adds release capability; it does not change existing spec behaviour. -->

## Impact

- **Enables** `agent-kit-download` (which depends on this) and the free agent-skill roadmap item.
- **Code/config:** publish configuration on the CLI workspace (`packages/cli`), a release workflow in
  `.github/workflows`, and a CI guard tying catalogue changes to version bumps.
- **External:** an npm package (`savedyouatoken`) and an `NPM_TOKEN` CI secret. The token is a secret
  configured in CI, never committed.
- **Free-tier static/zero-cost invariant:** no impact on the running site — this is build/release
  tooling, not runtime. The CLI stays a client-side/offline tool.
- **New runtime dependency:** none for the site. **New always-on infrastructure:** none (npm hosts the
  package; CI runs only on release).
- **Prompt privacy:** unaffected.
