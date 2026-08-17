# Prioritized product backlog

> **Status:** Planning portfolio. Each linked change has a complete OpenSpec proposal, delta
> specification, design, and implementation task list. Priority expresses dependency and learning
> value, not a promise of release timing.

## Priority model

- **P0 — foundation:** removes current adoption or trust blockers and establishes contracts required
  by later work.
- **P1 — validate the recurring loop:** turns production evidence into repeatable comparison and
  prevention, then tests whether teams retain and pay for it.
- **P2 — flagship product:** builds the smallest hosted Monitor only after the validation gate passes.
- **P3 — expansion:** adds collaboration, integrations, and enterprise operation only after Developer
  Monitor demonstrates retention and repeated demand.

Within a priority, the numbered order is the default implementation order. A change may begin in
parallel only when its dependency gate is already satisfied and it does not compete for the same
unstable contract or product decision.

## P0 — foundation

### 0. Reconcile existing OpenSpec work

**Status as of 2026-08-13:** `prompt-capture-sdk` is synced into the main specifications and archived.
The CLI bootstrap and clean `npx` audit are verified. The live Gumroad product and site link are
verified. Four operator checks remain before the other two changes can be archived:

- confirm the npm trusted-publisher target and bootstrap-credential revocation;
- prove OIDC and provenance on the next legitimate CLI version increase;
- confirm the current guarded kit archive is attached in Gumroad; and
- complete one $0 and one paid guest checkout and verify delivery.

Do not archive `publish-cli` or `agent-kit-download` until those respective checks pass. This keeps
the backlog accurate while allowing independent P0 planning work to continue.

### 1. Clarify product surfaces

**Status:** Completed and archived on 2026-08-13.

**Change:** [`clarify-product-surfaces`](changes/archive/2026-08-13-clarify-product-surfaces/)

**Outcome:** A visitor can distinguish the web analyser, CLI, runtime SDK, agent kit, and planned
Monitor, and can install the correct package without inference.

**Why first:** It resolves active website confusion with no infrastructure dependency and creates the
language used by every later launch.

**Gate:** Existing package names and availability must be confirmed; no other new change is required.

### 2. Version report and policy contracts

**Status:** Completed and archived on 2026-08-13.

**Change:** [`version-report-policy-contracts`](changes/archive/2026-08-13-version-report-policy-contracts/)

**Outcome:** SDK, CLI, local tools, Monitor, and third parties share prompt-free, versioned reports,
baselines, policies, validation, canonical identity, compatibility, and migrations.

**Why second:** Every comparison and handoff otherwise risks inventing an incompatible format.

**Gate:** The current share-report, SDK output, and CLI JSON formats have been inventoried.

### 3. Improve SDK operations

**Status:** Completed and archived on 2026-08-13.

**Change:** [`improve-sdk-operations`](changes/archive/2026-08-13-improve-sdk-operations/)

**Outcome:** Production teams can name workflows, associate releases, understand measurement
maturity, detect instrumentation failures, and diagnose masking without exposing prompts.

**Why now:** The SDK already captures requests; this closes the highest-friction gaps before asking
pilot teams to keep it installed.

**Depends on:** Contract field and compatibility decisions from change 2. Product documentation from
change 1 can ship first and be updated as these features land.

## P1 — validate the recurring loop

### 5. Add the CLI regression workflow

**Change:** [`add-cli-regression-workflow`](changes/add-cli-regression-workflow/)

**Outcome:** Teams discover repository assets, import production evidence, create baselines and
policies, see priced pull-request diffs, and enforce regression budgets in CI.

**Why before hosted Monitor:** It supplies durable prevention locally and tests a central paid-value
assumption without requiring a service.

**Depends on:** Change 2. It benefits from change 3's workflow/release metadata but can develop
discovery and direct-file baselines in parallel once contracts stabilize.

### 6. Add the local monitoring workbench

**Change:** [`add-local-monitoring-workbench`](changes/add-local-monitoring-workbench/)

**Outcome:** Developers can inspect prompt-free workflow history, maturity, before/after comparisons,
and policy export locally without an account.

**Why before hosted Monitor:** It provides immediate SDK value and prototypes the Monitor workflow at
low cost.

**Depends on:** Changes 2 and 3. Policy round-trip verification also depends on the relevant portion
of change 5.

### 7. Publish the Community source

**Change:** [`publish-community-source`](changes/publish-community-source/)

**Outcome:** Core, CLI, SDK, static web analyser, agent kit, contracts, tests, and documentation are
public under MIT and reproducibly released, while hosted stateful implementation remains private.

**Why here, deferred from P0:** Inspectable source is a trust and distribution prerequisite for
broader SDK adoption, but it does not gate change 5 or 6 engineering work, which only depend on
change 2's contracts. Publication is also irreversible and must follow the boundary and history
audit, so it is sequenced immediately before the step that actually needs it: recruiting pilot teams
who must be able to evaluate instrumentation trust from source. Deferred on 2026-08-17; see
[`docs/decisions.md`](../docs/decisions.md).

**Depends on:** Stable package boundaries; change 2's shared-contract location; accurate website
language from change 1; reconciliation of existing release changes. It does **not** depend on Monitor.

### 8. Run the Monitor validation pilot

**Change:** [`validate-monitor-pilot`](changes/validate-monitor-pilot/)

**Outcome:** Three to five qualified production teams complete a privacy-bounded journey, producing
behavioral evidence and a predeclared proceed, iterate, or stop decision.

**Why this is a release gate:** Product strategy supports tiering but does not yet prove recurring
use or willingness to pay. A hosted build before this step would automate an unvalidated workflow.

**Depends on:** Changes 2, 3, 5, and 6 sufficiently complete for real onboarding, comparison,
notification, and policy handoff. Change 7 should be public or publication-ready so pilot
participants can evaluate instrumentation trust.

## P2 — flagship product

### 9. Launch Developer Monitor

**Change:** [`launch-developer-monitor`](changes/launch-developer-monitor/)

**Outcome:** An individual developer can ingest prompt-free reports, retain workflow history, compare
deployments, receive regression alerts, export CI policy, and manage a predictable subscription.

**North star:** This is the smallest implementation of savedyouatoken Monitor—the flagship closed
loop—not a paid SDK tier.

**Hard gate:** Change 8 must record a **proceed** decision against its predeclared evidence threshold.
Changes 2 and 7 must establish the public/private boundary, and local comparison parity must pass.
Billing remains inactive until those conditions are true.

## P3 — expansion after retention

### 10. Expand team, enterprise, and ecosystem capabilities

**Change:** [`expand-team-enterprise-ecosystem`](changes/expand-team-enterprise-ecosystem/)

**Outcome:** Validated demand can add workspaces, ownership, RBAC, audit trails, central policy,
Slack/Teams, OpenTelemetry, Python/framework adapters, enterprise identity and data controls, custom
catalogues, and supported self-hosting.

**Hard gate:** Developer Monitor must demonstrate retained recurring use. Each capability inside this
horizon receives its own customer-evidence and release gate; this is not a big-bang release.

**Default internal order:**

1. shared workspaces and workflow ownership;
2. RBAC, policy inheritance, and audit trails;
3. the single highest-demand notification or telemetry integration;
4. the single highest-demand language or framework adapter; and
5. enterprise identity, data controls, and self-hosting with design partners.

## Critical path

The shortest path to a validated flagship is:

```text
Reconcile existing work
  → clarify product surfaces
  → version shared contracts
  → improve SDK operations
  → CLI regression workflow + local workbench
  → publish the Community source
  → validation pilot
  → proceed / iterate / stop
  → Developer Monitor only on proceed
```

The Community source release depends only on the shared-contract and product-boundary work from
changes 1–3, so it can be prepared in parallel with changes 5–6, but it is sequenced immediately
before pilot recruitment because that is the first point where its absence actually costs something.
Team and enterprise work stays outside the critical path.

## Portfolio rules

- Do not start paid infrastructure to create the appearance of progress before the pilot gate.
- Do not transmit or persist raw prompts in any new report, local store, pilot, or hosted service.
- Do not make Community analysis depend on auth, billing, a database, network availability, or a
  private package.
- Do not add integrations without a support owner, compatibility matrix, and evidence of demand.
- Do not equate a cost reduction with quality preservation; require evaluation guidance at every
  baseline-approval boundary.
- Reprioritize when observed adoption contradicts this plan, and record the evidence and decision.

## Definition of portfolio completion

This backlog has succeeded when savedyouatoken can demonstrate the complete loop:

```text
Visibility → action → measured proof → enforced control → detected regression
```

The end state is not the number of shipped packages. It is a trusted, repeated workflow in which
Community tools create value independently and Monitor earns revenue by retaining and operationalizing
that value.
