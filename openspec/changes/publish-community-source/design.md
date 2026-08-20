## Context

The monorepo is private and MIT-licensed, and currently mixes Community components with dormant
Auth.js, database, entitlement, Stripe, billing, and webhook boundaries. Git history and local
artifacts must be treated as potentially sensitive until audited. Public npm packages already create
an expectation that repository metadata will resolve to inspectable source.

## Goals / Non-Goals

**Goals:**

- Publish a coherent Community monorepo with verifiable source-to-package releases.
- Establish a maintainable public/private boundary before changing visibility.
- Make contribution and vulnerability handling operational on day one.

**Non-Goals:**

- Open-source the hosted control-plane implementation.
- Launch paid Monitor during the source publication.
- Promise response or support SLAs for Community users.

## Decisions

**Keep one public Community monorepo and create one private cloud repository.** Shared analysis,
contracts, SDK, CLI, agent kit, and static web content stay together; stateful service code moves.
Publishing package-by-package repositories was rejected because it would multiply release and
contribution overhead and obscure shared-engine parity.

**Classify files before moving them.** Every current path receives a `public`, `private`, or `shared
contract` decision. Environment flags are not treated as confidentiality. Making the current repo
public first and cleaning later was rejected as irreversible disclosure.

**Audit history, then choose preservation or a clean root.** Preserve contribution history when it
is safe. If sensitive data cannot be removed with high confidence, publish a reviewed clean history
and retain the private original as an internal archive. In either case, rotate leaked secrets.

**Release only from public protected tags.** npm provenance, package-content inspection, and source
links form one chain. Continuing maintainer-laptop releases was rejected because public trust depends
on traceability.

**Use a lightweight maintainer model initially.** Maintainers retain final product decisions, accept
MIT contributions through pull requests, and document Community support as best effort. A CLA and
formal foundation were rejected until legal or contributor scale requires them.

## Risks / Trade-offs

- [History audit misses sensitive material] → Use multiple scanners plus manual review and test the
  exact public clone.
- [Repository split causes logic duplication] → Keep logic and contracts public; private code owns
  state, operations, and commercial workflows only.
- [Public support load distracts development] → Scope templates, label supported work, and publish no
  Community SLA.
- [Forks compete with hosted Monitor] → Differentiate on reliable operations, integrations,
  governance, and support instead of restricting local analysis.

## Migration Plan

Create and back up the private cloud repository, inventory the monorepo, move stateful code, and
replace necessary crossings with public contracts. Audit and remediate the entire history, then
verify a fresh clone and release candidate. Freeze nonessential changes for final review, change
visibility, publish matching tags/packages, and update product claims. If final verification fails,
keep the repository private; after publication, rollback means fixing forward because public history
cannot be made private again.
