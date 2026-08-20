## Context

The site already has `/cli` and `/kit`, while the separate runtime SDK package has no equivalent
product route. Product language is repeated across route components and the README, making semantic
drift likely. All educational pages must preserve static generation and the site's visual identity.

## Goals / Non-Goals

**Goals:**

- Make one shared product taxonomy visible across navigation, pages, metadata, and documentation.
- Route visitors by problem before exposing installation details.
- Keep every new route static and accessible without configuration.

**Non-Goals:**

- Redesign the analyser itself.
- Implement Monitor or accept payments.
- Merge the CLI and SDK packages.

## Decisions

**Represent the taxonomy as shared structured content.** Product names, jobs, package identifiers,
availability, and routes will come from one typed content structure used by navigation and chooser
components. This avoids independently maintained copy. Keeping duplicated page-local strings was
considered and rejected because it recreates the current ambiguity.

**Use job-first labels with package names in supporting copy.** Navigation must remain scannable,
while the route hero and install block carry exact npm identities. Package-first navigation was
rejected because new visitors do not yet know which package they need.

**Keep Monitor visibly pre-launch.** Its route can explain the closed-loop vision and collect pilot
interest only through an existing explicitly configured mechanism. A disabled pricing card was
rejected because it still implies a sellable product.

**Test semantics as well as rendering.** Route tests will assert the package names, cross-links, and
the “kit is not SDK” statement so copy edits cannot silently reintroduce confusion.

## Risks / Trade-offs

- [More choices make navigation crowded] → Keep the top level job-oriented and move comparison
  detail into the chooser.
- [Shared content makes bespoke pages feel repetitive] → Share facts and labels, not entire page
  narratives.
- [Pilot language becomes stale] → Centralize availability state and include it in release review.

## Migration Plan

Add the shared taxonomy and `/sdk` route first, then migrate `/cli`, `/kit`, navigation, footer, and
README copy. Verify static rendering and links before exposing the Monitor placeholder. Rollback is
a normal content/component revert with no stored-data migration.
