## Why

Visitors cannot reliably distinguish the CLI, runtime SDK, and agent kit because the CLI and kit
both point to the same npm package while the SDK lacks an equivalent product page. Clarifying the
product family is the fastest way to remove adoption friction before adding more offerings.

## What Changes

- Add a dedicated `/sdk` page explaining runtime request capture, privacy, maturity, and supported
  providers.
- Clarify `/cli` as the file and CI surface and `/kit` as instructions that operate the CLI.
- Add a shared product chooser, job-oriented navigation labels, and consistent package names across
  product pages and the README.
- Add an honest placeholder for Monitor that collects pilot interest without presenting an
  unshipped product as available.

## Capabilities

### New Capabilities

- `product-surface-navigation`: Product pages and navigation distinguish the web audit, CLI,
  runtime SDK, agent kit, and future Monitor by user job and package boundary.

### Modified Capabilities

None.

## Impact

Primarily `apps/web` static pages, shared navigation/footer components, metadata, sitemap, and
README documentation. There is no impact on the free-tier static/zero-cost invariant, no new runtime
dependency, no paid service, and no always-on infrastructure.
