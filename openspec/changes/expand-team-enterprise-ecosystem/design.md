## Context

This change follows a retained Developer Monitor, not merely its launch. It spans the private control
plane and public integration packages, and it introduces organizational authorization, third-party
delivery, additional runtimes, and self-hosting obligations. Demand must determine the order within
this horizon.

## Goals / Non-Goals

**Goals:**

- Extend a validated single-developer loop to teams and constrained organizations.
- Keep contracts and deterministic analysis consistent across languages and deployments.
- Add integrations without putting them in the provider request path.

**Non-Goals:**

- Build every listed integration simultaneously.
- Turn savedyouatoken into a generic observability platform or LLM gateway.
- Change the value or license of local Community analysis.

## Decisions

**Sequence by repeated demand, with separate release gates.** Team governance comes before broad
ecosystem and enterprise work unless customer evidence says otherwise. Treating this proposal as one
big-bang release was rejected; its capabilities are independently deliverable.

**Use workspace-scoped authorization as the common tenancy unit.** Every workflow, policy,
integration, audit event, and entitlement is attached to a workspace, with role checks centralized
at service boundaries. Feature-local permission checks were rejected as too easy to diverge.

**Use an append-only audit event model.** Governance mutations capture actor, action, target, prior
and new references, time, and origin. Mutable activity rows were rejected because they cannot support
credible audits.

**Keep integrations asynchronous and contract-driven.** Notification and telemetry adapters consume
prompt-free regression or health events. Framework and language SDKs produce the same public report
contract. Direct cross-integration database reads were rejected.

**Share conformance fixtures across languages.** Provider request fixtures, expected normalized
shapes, report bytes, and privacy canaries become a public suite. Independent implementations without
conformance tests were rejected because “same engine” would become only a marketing claim.

**Package self-hosting as a supported product, not a source checkout.** Signed releases, migration
preflight, backup/restore, health checks, and explicit customer/vendor responsibilities define the
offering. Calling the Community repository an enterprise deployment was rejected.

## Risks / Trade-offs

- [Scope expands beyond product focus] → Require customer evidence and capability-specific gates;
  reject generic telemetry features unrelated to cost structure.
- [RBAC errors expose tenant data] → Centralize authorization, test a permission matrix, and audit
  denied and privileged actions.
- [Third-party API churn creates maintenance load] → Publish support matrices and isolate adapters
  behind event contracts.
- [Cross-language engines drift] → Prefer shared artifacts or bindings where practical and enforce
  conformance fixtures in every release.
- [Self-hosting multiplies support burden] → Limit supported topologies and price operational support
  explicitly.

## Migration Plan

Deliver team workspaces and ownership behind an entitlement, migrate existing developer accounts into
single-member workspaces, then add roles, policy inheritance, and audit logs. Add integrations one at
a time behind contract tests. Pilot enterprise identity and self-hosting with design partners before
general availability. Every stage supports rollback through feature gating; irreversible data-model
migrations require backups and tested downgrade or forward-fix procedures.
