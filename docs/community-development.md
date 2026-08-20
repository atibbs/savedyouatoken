# Community development and release boundaries

This guide describes the intended public Community repository. While the source-publication change
is in progress, dormant private-control-plane files may still be present; the boundary inventory in
[`community-boundary.md`](community-boundary.md) is authoritative about what must move first.

## Fresh-clone setup

Requirements:

- Node.js 20.9 or newer;
- npm, using the committed lockfile; and
- no account, API key, database, private package, or Monitor access.

```bash
git clone https://github.com/atibbs/savedyouatoken.git
cd savedyouatoken
npm ci
npm run typecheck
npm test
npm run build
npm run build:cli
npm run verify:cli
npm run build:sdk
npm run verify:sdk-types
npm run build:kit
npm run openspec:validate
```

The public site requires only optional `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_KIT_URL` values. A
Community verification run must not configure auth, database, billing, or provider credentials.

## Architecture boundary

Community owns deterministic analysis, local execution, in-process SDK capture, local/CI
enforcement, browser-local storage, public contracts, documentation, and reproducible packages.
The private control plane owns authentication, durable hosted storage, entitlement, billing,
customer administration, alerts, and hosted Monitor operations.

The dependency direction is one-way:

```text
private hosted service -> released public contracts
Community software     -X-> private code, registry, credentials, or infrastructure
```

See [`architecture.md`](architecture.md) for the application design and
[`contracts.md`](contracts.md) for the shared report, baseline, and policy formats.

## Local-only operation

The analyser runs in the browser. The CLI reads local files. The SDK processes provider request
shapes in the application process and is silent in production unless the application configures a
sink. Community operation must not silently upload prompt text or reports. Synthetic examples are
the only prompt-like content accepted into the repository.

## Releases

CLI and SDK releases must originate from protected CI, use npm trusted publishing with provenance,
and publish the exact tarball verified by the workflow. A release commit must contain the package
version and matching source. Future public releases will use protected `v*` tags after the tag-based
release migration is complete.

Before release:

1. run the fresh-clone command set above;
2. inspect package tarballs, declarations, source maps, licenses, and embedded filesystem paths;
3. install the exact tarball in a clean consumer and exercise its primary command or API;
4. confirm repository and issue links resolve to the matching public source; and
5. prepare notes describing Community scope, hosted scope, compatibility, and security handling.

Maintainer-specific npm credentials are not accepted. Release automation must use the least
privilege required to publish the intended package.
