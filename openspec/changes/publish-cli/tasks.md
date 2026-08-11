## 1. Make the CLI publishable

- [ ] 1.1 Configure `packages/cli/package.json` for publication: public access, a `files` allowlist (built `dist/` + `bin`), a `bin` entry, `engines`, and metadata (repository, license, description)
- [ ] 1.2 Add a `prepublishOnly` that builds the tsup bundle, so a publish can never ship a stale `dist/`
- [ ] 1.3 `npm pack` dry-run: confirm the tarball contains exactly the intended files and the `bin` runs from it

## 2. Release automation

- [ ] 2.1 Add `.github/workflows/release.yml` triggered on a semver tag: build, publish to npm with provenance using the `NPM_TOKEN` secret
- [ ] 2.2 Document the one-time bootstrap: claim the `savedyouatoken` name, create a granular npm automation token, add it as the `NPM_TOKEN` CI secret

## 3. Staleness guard

- [ ] 3.1 Add a CI check that fails a change which modifies the pricing catalogue (keyed on `PRICES_VERIFIED_ON` or a hash of the price data) without a corresponding CLI version bump
- [ ] 3.2 Wire the guard into the existing `ci.yml` so it runs on every pull request

## 4. Post-publish verification

- [ ] 4.1 Add a smoke-test job that runs `npx savedyouatoken@<published-version>` in a clean environment (no repo on PATH) and asserts it executes and prints the version
- [ ] 4.2 Fail the release if the smoke test fails

## 5. First release + verify

- [ ] 5.1 Cut the first release (tag + workflow) and confirm `npm view savedyouatoken` resolves
- [ ] 5.2 Confirm `npx savedyouatoken@latest` runs a real audit end to end from a clean environment
- [ ] 5.3 Simulate a price change and confirm the guard fails without a bump, then passes with one and publishes a new `latest`
