## Why

The site has a free audience and, with the Pro subscription shelved, no way to learn whether any
of them will pay. A downloadable, pay-what-you-want **cost-aware agent kit** for individual
developers gives a low-commitment paid artifact *and* doubles as the cheapest willingness-to-pay
experiment — the exact signal the Pro decision was blocked on. It also plants the tool inside the
editors and agents where machine-written prompts bloat, a distribution channel the website cannot
reach.

This **deliberately revises** the earlier decision to *not* sell a downloadable skill (recorded as
"Intentionally excluded" in `docs/future-roadmap.md`). Two of that decision's three objections are
now resolved: the decisive one — a frozen download quoting stale prices with confidence — is
dissolved by a **launcher design** (the kit invokes the live `npx savedyouatoken` CLI and embeds no
prices); and enforceability stops mattering under **pay-what-you-want**, which monetises goodwill and
convenience, not defensible IP. The third rationale — "give it away purely as a funnel to the
subscription" — is moot now that Pro is shelved.

## What Changes

- A new **static `/kit` landing page** describing the kit, plus "Get the kit" CTAs on `/cli` and in
  the footer.
- The **kit authored in-repo** (version-controlled) and packaged for upload to Gumroad: a `SKILL.md`
  (Claude Code), a Cursor/`CLAUDE.md` snippet, a one-page usage guide, and a one-page cheat-sheet of
  the waste patterns — all invoking the live CLI, none embedding prices.
- **Distribution and payment via Gumroad** as merchant of record: pay-what-you-want with a $0 floor +
  suggested tip, wallets/Apple Pay/Google Pay, guest checkout, global tax/delivery/receipts handled
  externally.
- **Interest measured without third-party tracking**: Gumroad's own dashboard (views, % who pay,
  average voluntary price) plus an optional first-party, cookieless CTA-click count.
- Supersedes the "Selling the agent skill as a paid downloadable asset" exclusion; the decision log
  and roadmap record the reversal and its reasoning.

## Capabilities

### New Capabilities
- `kit-distribution`: offering a downloadable, always-current (launcher-not-snapshot) developer kit
  for sale under pay-what-you-want, through a low-friction outbound purchase flow, with
  privacy-respecting interest measurement.

### Modified Capabilities
<!-- None. The prior "don't sell the skill" stance lives in docs, not an OpenSpec spec; it is
     updated as part of Impact rather than as a spec delta. -->

## Impact

- **Depends on the `publish-cli` change.** The kit's launcher target must resolve and remain current.
  The bootstrap dependency was satisfied on 2026-08-13 when `savedyouatoken@0.1.0` was published and
  a clean `npx savedyouatoken@latest` audit passed; steady-state release verification remains tracked
  in `publish-cli`.
- **Code/content:** a static `/kit` page + CTAs in `apps/web`; the kit source authored in-repo (e.g.
  `kit/`) and packaged into a downloadable archive.
- **External:** a Gumroad product (created in Gumroad's dashboard, outside the codebase) that the
  CTAs link to. Gumroad — not us — is merchant of record for payment, tax, delivery and receipts.
- **Docs:** supersede the "Selling the agent skill…" exclusion in `docs/future-roadmap.md` and record
  the reversal in `docs/decisions.md`.
- **Free-tier static/zero-cost invariant:** preserved. `/kit` is static and the CTA is an outbound
  link — no server on the free path. If the optional first-party click counter is built it is the one
  small dynamic endpoint (cookieless, no PII); it may be omitted for v1 to stay fully static.
- **No-third-party-script property:** preserved — the CTA is a plain link, not Gumroad's overlay JS.
  The on-site overlay is an explicit out-of-scope enhancement.
- **Launcher-not-snapshot:** the kit embeds no prices or model catalogue data; a guard test asserts
  this.
- **New runtime dependency:** none. **New paid/always-on infrastructure:** none (Gumroad is external
  and merchant of record).
- **Prompt privacy:** unaffected — the kit and the purchase flow never touch user prompts.
