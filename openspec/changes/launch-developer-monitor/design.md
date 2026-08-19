## Context

Monitor is gated on successful pilot evidence. Community clients emit versioned prompt-free reports;
the dormant auth, database, entitlement, and Stripe boundaries that used to live in this repository
now live in the private `savedyouatoken-cloud` repository. Hosted state introduces security,
deletion, availability, and billing obligations absent from the free product.

## Goals / Non-Goals

**Goals:**

- Deliver the smallest repeatable history-to-regression loop for one developer.
- Keep Community clients decoupled from service availability.
- Make privacy, entitlement, retention, and operational failures explicit.

**Non-Goals:**

- Store raw prompts or proxy provider traffic.
- Provide team RBAC, enterprise networking, or arbitrary observability.
- Charge per token or request.

## Decisions

**Ingest immutable report envelopes and derive views asynchronously.** The ingestion endpoint
validates, authenticates, rate-limits, deduplicates by content identity, stores the source envelope,
and queues comparison work. Synchronous full analysis was rejected because the provider request must
never depend on Monitor latency.

**Use relational tenancy with ownership on every row.** Workflow, report, baseline, regression,
destination, and entitlement records carry an account boundary enforced in query helpers and tested
for cross-tenant access. A global report table with application-only filtering was rejected.

**Reuse public compatibility and policy code.** The private service consumes the same contract
package as Community tools. Reimplementing comparisons server-side was rejected because it would
create conflicting cost answers.

**Use an outbox-backed alert worker.** Regression creation and pending notification are committed
together, then retried idempotently with visible status. Fire-and-forget request-handler delivery was
rejected due to lost alerts and duplicate retries.

**Keep database entitlement authoritative.** Verified Stripe webhooks are idempotent writers; request
paths read persisted state. Direct Stripe checks on every request were rejected for latency and
availability reasons.

**Price predictable resources.** Developer Pro is based on a subscription with documented workflow,
retention, or workspace limits—not metered tokens. Usage pricing was rejected because it conflicts
with the product's cost-reduction incentive.

## Risks / Trade-offs

- [Prompt-free schemas still carry identifying metadata] → Allowlist fields, bound tags, document
  retention, and provide deletion/export.
- [Alerts create operational burden] → Start with one channel, use an outbox, expose delivery health,
  and avoid implicit SLA claims.
- [Pricing assumptions change over history] → Preserve source catalogue context and make repricing a
  separate derived view.
- [Billing failure locks useful evidence] → Use a grace state and preserve export/deletion access.

## Migration Plan

Provision an isolated private environment, deploy ingestion in shadow mode for consenting pilot
reports, and verify parity with local comparisons. Enable history, then baselines, regressions, and
one alert channel. Activate billing only after operational and pilot gates pass. Roll back features
behind server flags while preserving export/deletion; Community sinks continue locally if Monitor is
unavailable.
