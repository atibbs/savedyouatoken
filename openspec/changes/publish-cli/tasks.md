## 1. Make the CLI publishable

- [ ] 1.1 Configure `packages/cli/package.json` for publication: public access, a `files` allowlist (built `dist/` + `bin`), a `bin` entry, `engines`, and metadata (repository, license, description)
- [ ] 1.2 Add a `prepublishOnly` that builds the tsup bundle, so a publish can never ship a stale `dist/`
- [ ] 1.3 `npm pack` dry-run: confirm the tarball contains exactly the intended files and the `bin` runs from it
- [ ] 1.4 Single-source the CLI version from `package.json`: inject it at build (tsup `define` or read `package.json`), remove the hard-coded `const VERSION` in `src/index.ts`, and test the packed binary reports the tarball's version

## 2. Release automation (coupled to the merge, staged, OIDC)

- [ ] 2.1 Add `.github/workflows/release.yml` triggered on **push to `main`**: when `packages/cli`'s version is ahead of the version on npm, build and publish — so a merged bump ships automatically, with no manual tag step
- [ ] 2.2 Publish to a **candidate dist-tag** (e.g. `rc`), never directly to `latest`; authenticate with **GitHub Actions trusted publishing (OIDC, `id-token: write`)** and provenance — no long-lived `NPM_TOKEN`
- [ ] 2.3 Document the one-time bootstrap: claim the `savedyouatoken` name with a short-lived token, configure the repo/workflow as a trusted publisher, then revoke the bootstrap token

## 3. Staleness guard

- [ ] 3.1 Add a CI check that fails a change which modifies the pricing catalogue (keyed on `PRICES_VERIFIED_ON` or a hash of the price data) without a corresponding CLI version bump
- [ ] 3.2 Wire the guard into the existing `ci.yml` so it runs on every pull request

## 4. Verify the candidate, then promote

- [ ] 4.1 Add a job that installs `savedyouatoken@<candidate>` from the registry in a clean environment (no repo on PATH) and asserts it executes and prints its published version
- [ ] 4.2 Promote the candidate to `latest` (`npm dist-tag add`) only if that check passes; on failure, fail the release and leave `latest` unchanged

## 5. First release + verify

- [ ] 5.1 Perform the first release through the workflow (bootstrap → merge-triggered publish → candidate → verify → promote) and confirm `npm view savedyouatoken` resolves
- [ ] 5.2 Confirm `npx savedyouatoken@latest` runs a real audit end to end from a clean environment
- [ ] 5.3 Simulate a price change: confirm the guard fails without a version bump, then with a bump the merge publishes a candidate, verifies it, and promotes a new `latest`
