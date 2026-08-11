## Context

See `proposal.md — Why` (including why this reverses the prior "don't sell the skill" exclusion).
Requirements are in `specs/kit-distribution/spec.md`. The relevant constraints from the project: the
site is fully static with no third-party scripts, and the pricing catalogue lives only in
`packages/core` and goes stale if copied.

**Dependency:** the launcher target `npx savedyouatoken@latest` is **not yet published to npm**
(`npm view savedyouatoken` returns E404, and there is no release workflow). The launcher-not-snapshot
design is hollow until it resolves and is kept current, so this change **depends on the `publish-cli`
change** (publish the CLI + a release process that republishes when `packages/core` prices change).
The kit must not be launched before that lands.

## Goals / Non-Goals

**Goals:**
- One-line-effort purchase for the buyer, with the seller owning no tax/delivery/compliance.
- Keep the site static, script-clean, and prompt-private while adding the offer.
- A kit that cannot go stale.

**Non-Goals:**
- In-house checkout *code*, accounts, or any server on the free path.
- The on-site overlay enhancement, and any first-party click counter (both deferred).

(Note: creating/configuring the Gumroad product is a *manual dashboard* step, not code — but it is a
**launch-blocking task**, not out of scope. The capability is not done until it exists and checkout
is verified.)

## Decisions

**Gumroad as merchant of record.** It handles global VAT/sales tax on digital goods, delivery,
receipts, the pay-what-you-want UI, wallets (Apple/Google Pay), and guest checkout — i.e. all the
buyer-friction and seller-compliance work — for roughly a 10% cut. Alternatives: **Lemon Squeezy**
(near-equivalent MoR; keep as the drop-in fallback), **in-house Stripe** (best raw wallet UX but we
would own worldwide digital-goods tax — rejected for a v1 experiment), **Ko-fi/Buy Me a Coffee**
(lower fee, tip-native; the fallback if we later reframe as a pure tip jar). The spec stays
provider-agnostic so switching is a one-link change.

**A plain outbound link, not Gumroad's overlay script.** The overlay needs Gumroad's third-party JS,
which breaks the no-third-party-script property for a modest UX gain (an on-page modal vs a redirect).
Gumroad's own product page is already low-friction (PWYW + wallets), so a redirect is an acceptable
v1. The overlay is a documented, opt-in enhancement scoped to `/kit` only, if we ever want it.

**Launcher-not-snapshot content.** The `SKILL.md`, the Cursor/`CLAUDE.md` snippet, and the usage
guide instruct the agent/developer to run `npx savedyouatoken@latest` against their prompt files
(including the agent's own `CLAUDE.md`, MCP tool definitions, and skill descriptions) — so every
figure is produced live. The cheat-sheet covers *patterns*, which are evergreen, and quotes no
prices. A **guard test** fails if any catalogue model id or price-shaped token appears in the kit —
run over **both the source and the unpacked distributable archive in CI** (packaging can add
generated files or ship a stale archive a source-only scan would miss), with the archive's file
manifest verified against `kit/`.

**Kit authored in-repo, packaged into an archive.** The kit lives under `kit/` (version-controlled,
reviewable), and a small script produces the archive uploaded to Gumroad. This keeps the product
reproducible and lets the guard test run in CI. The upload itself is a manual dashboard step.

**Static `/kit` page + config-gated CTA — but coming-soon is a prelaunch fallback, not the finish
line.** `/kit` is a normal prerendered page (also an SEO surface). The Gumroad product URL is a
public value in site config; when it is unset the CTA shows a "coming soon" state so the page can
ship before the Gumroad product exists. CTAs also appear on `/cli` and in the footer. Crucially, the
capability is **not complete in the unset state**: the spec requires the entry points to lead to a
working purchase flow, so the definition of done includes launch-blocking steps — create/configure
the Gumroad product (PWYW, $0 floor + tip), upload the archive, set the URL, and verify both a $0 and
a paid **guest** checkout — even though the product creation itself happens in Gumroad's dashboard.
Product creation being external is not a licence to leave the capability at coming-soon.

**Measurement without tracking, for v1.** Rely on Gumroad's dashboard (views, % who pay, average
voluntary price = the WTP signal) plus the referrer Gumroad already records for site-originated
traffic. No site-side analytics ship in v1, preserving both the static and no-tracking properties.
The optional first-party, cookieless CTA-click counter is deferred; if built later it is a tiny
no-PII, no-cookie endpoint — the one thing that would add a dynamic route.

## Risks / Trade-offs

- **Redirect friction vs. overlay** → accepted; Gumroad's page is low-friction and the overlay stays
  available as a scoped enhancement.
- **~10% fee on small amounts** → accepted for a v1 whose goal is the WTP signal, not margin;
  revisitable (Ko-fi is lower-fee, Stripe is lower-fee-but-higher-ops).
- **A price could sneak into the kit** → the guard test scans for catalogue ids and price tokens and
  fails the build; keep kit prose price-free by policy.
- **Platform coupling** → mitigated: provider-agnostic spec, one config URL, MoR is swappable.
- **The kit must be genuinely useful** → it wraps the live CLI to audit real prompt files, including
  an agent's own configuration; if it is not useful, PWYW revenue and referrals both fail — which is
  itself the signal the experiment is meant to read.

## Open Questions

- The suggested tip tiers (e.g. $0 / $5 / $20 framing). A tunable set in Gumroad; does not affect the
  specs, approach, or task breakdown.
