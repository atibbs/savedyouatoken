## 1. Make the CLI publishable

- [x] 1.1 Configure `packages/cli/package.json` for publication: public access, a `files` allowlist (built `dist/` + `bin`), a `bin` entry, `engines`, and metadata (repository, license, description)
- [x] 1.2 Add a `prepublishOnly` that builds the tsup bundle, so a publish can never ship a stale `dist/`
- [x] 1.3 `npm pack` dry-run: confirm the tarball contains exactly the intended files and the `bin` runs from it
- [x] 1.4 Single-source the CLI version from `package.json`: inject it at build (tsup `define` or read `package.json`), remove the hard-coded `const VERSION` in `src/index.ts`, and test the packed binary reports the tarball's version

## 2. Release automation (coupled to the merge, verified, single OIDC publish)

- [x] 2.1 Add `.github/workflows/release.yml` on **push to `main`**, gated by `scripts/release-gate.mjs` — release only when the CLI version is absent from npm and semver-greater than `latest` (idempotent + monotonic)
- [x] 2.2 On release: build, **pack once**, verify that tarball (group 4), then **publish that same tarball once directly to `latest`** via **OIDC trusted publishing** + provenance — verified == published, no candidate dist-tag, no stored `NPM_TOKEN`
- [x] 2.3 Document the one-time bootstrap: the first publish uses a short-lived token but follows the same verify-first flow; then configure the repo/workflow as a trusted publisher and revoke the token

## 3. Staleness guard

- [x] 3.1 Add a CI check that fails a change which modifies the pricing catalogue without a **semver increase** of the CLI version over the base branch (a downgrade or reused version also fails); share the `gt()` ordering with the release gate (`scripts/semver.mjs`)
- [x] 3.2 Wire the guard into the existing `ci.yml` so it runs on every pull request

## 4. Verify before publishing (through the installed command)

- [x] 4.1 Verify the **packed tarball** (the exact one that will be published) through npm's installed `savedyouatoken` **shim** — assert the reported version and run **one real audit** — not by invoking `dist/index.js` directly (`scripts/verify-packed-cli.mjs`, which accepts a tarball path; also run in PR CI on a freshly packed tarball)
- [x] 4.2 Publish that same tarball only if verification passes; on failure nothing is published and `latest` is unchanged

## 5. First release + verify (operator — needs an npm account; see `packages/cli/RELEASING.md`)

These steps require npm credentials and the one-time trusted-publisher setup on npmjs.com, so they
are performed by the operator, not in this change. The code, workflow, and guard above are complete
and inert until then — the same "build the boundary, document activation" pattern as Stripe.

- [ ] 5.1 Perform the first release through the workflow (bootstrap → merge-triggered publish → candidate → verify → promote) and confirm `npm view savedyouatoken` resolves
- [ ] 5.2 Confirm `npx savedyouatoken@latest` runs a real audit end to end from a clean environment
- [ ] 5.3 Simulate a price change: confirm the guard fails without a version bump, then with a bump the merge publishes a candidate, verifies it, and promotes a new `latest`
