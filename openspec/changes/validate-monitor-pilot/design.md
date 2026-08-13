## Context

The product strategy calls for validation with three to five teams before paid infrastructure. Local
reports and comparisons can provide most pilot value; any centralized handling remains prompt-free
but introduces privacy and operational obligations. Praise for a single audit is not evidence of a
recurring product.

## Goals / Non-Goals

**Goals:**

- Collect decision-quality evidence across the complete user journey.
- Learn which recurring service users value before automating it.
- Protect participants with an explicit, narrow data and support boundary.

**Non-Goals:**

- Provide a generally available or SLA-backed service.
- Optimize conversion metrics through broad acquisition.
- Activate Stripe or finalize tier pricing.

## Decisions

**Use a written pilot protocol and cohort ledger.** Eligibility, consent, milestones, interventions,
and outcomes are recorded consistently. Ad hoc customer conversations were rejected because they
invite selective interpretation.

**Prefer local tools plus manual prompt-free operations.** Automate only what is necessary for
reliable measurement. Building the production control plane first was rejected because it spends
before validating the recurring hook.

**Precommit decision thresholds.** Proceed requires repeated use across multiple teams, at least one
acted-on comparison or regression, retained instrumentation, and credible willingness-to-pay
evidence. Exact numeric thresholds live in the pilot runbook and are frozen before enrollment.

**Separate product evidence from vanity feedback.** Behavioral milestones receive more weight than
stated enthusiasm, stars, or first-report satisfaction. Interviews contextualize behavior rather
than replace it.

**Minimize identity and report retention.** Use participant IDs in the evidence dataset and keep
contact details separately. Raw prompts are prohibited. This reduces breach impact and keeps the
pilot aligned with product privacy claims.

## Risks / Trade-offs

- [Tiny cohort produces noisy evidence] → Select varied but qualified teams and treat thresholds as a
  directional gate, not statistical proof.
- [High-touch support inflates retention] → Record every manual intervention and ask whether the
  workflow remains valuable without it.
- [Participants share sensitive metadata] → Validate strict schemas and reject arbitrary fields.
- [Changing the product mid-pilot biases results] → Cohort changes by phase and records versioned
  interventions.

## Migration Plan

Finalize the protocol and gate, recruit sequentially, then onboard one team as a dry run before the
full cohort. Review data boundaries after that run without changing success criteria silently. At
completion, export the evidence record and choose proceed, iterate, or stop. Delete temporary stores
on schedule; if proceeding, migrate only consented compatible reports into Monitor.
