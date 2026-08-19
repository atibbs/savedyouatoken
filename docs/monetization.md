# Monetization

> **Status: specced but deferred.** This document is the full monetization spec and is kept current
> as the intended design. The Pro tier is **not being built** — see `docs/decisions.md` ("Defer the
> Pro tier"). The stateful boundary exists and is inert; the paid product waits on demand validation.

## Thesis

The product denominates itself in the customer's own dollars. It ends an interaction by saying "this
prompt is costing you $795 a month, and $235 of that is recoverable." Selling a $19/month tool to
someone you have just shown a $2,300/year leak is an unusually short conversation.

But the audit itself is a **one-time event**, and one-time value is a bad subscription. Nobody
renews a monthly payment for a problem they fixed in March.

What recurs is the *regrowth*. Prompts grow by accretion — every incident adds a rule, every edge
case adds an example, and nothing is ever deleted because deleting a prohibition feels riskier than
appending one. Six months later the prompt has doubled and the invoice followed it.

So: **the audit is free forever, and the budget that stops it growing back is the product.**

## Primary revenue model: Pro subscription

**$19/month per developer. $79/month for a team of five.**

| Free (permanent) | Pro |
|---|---|
| All 26 waste patterns, no gates | Unlimited saved prompts with version history |
| Full lossless rewrite + diff | Diff any two versions, priced |
| Cache simulation and breakeven maths | Regression alerts when a prompt grows past budget |
| Cross-model cost comparison | GitHub Action that comments on and fails pull requests |
| Shareable reports | Batch analysis across a prompts directory |
| 3 saved prompts, in-browser | Team workspaces and shared history |
| The CLI, including CI budgets | |

The free tier is deliberately not crippled. Every interesting number stays free, because a tool that
paywalls its insight does not get recommended, and being recommended is the entire distribution
strategy (see `docs/growth.md`). The paywall sits on *persistence and enforcement*, which is
genuinely a hosted-service problem rather than an artificial gate.

**Why this is not a generic subscription bolted onto a free tool.** The paid features cannot exist
client-side: history across sessions and machines, alerting, and a bot commenting on a pull request
all require a server that remembers things. The free/paid line is the same line as the
stateless/stateful line, which is the honest place for it.

### Current state

Billing was **wired but inactive** — the checkout, webhook, and customer-portal route handlers and
entitlement persistence were built and merged, then moved to the private `savedyouatoken-cloud`
repository as part of publishing this repository's source (see `docs/community-boundary.md`); they
are preserved there, not deleted, but are no longer part of this repository. The `/pricing` page
shows a plain "not yet available" state, and no waitlist collects addresses.

Activation is *configuration, not code*, but it now means deploying and configuring
`savedyouatoken-cloud` rather than setting env vars on this static site:

- **Stripe** — create a product and monthly price, and set `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_PRO_MONTHLY`.
- **Auth** — set `AUTH_SECRET` and a GitHub OAuth app (`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`);
  without sign-in there is no user to attach an entitlement to, and checkout requires a session.
- **Database** — set `DATABASE_URL` and apply the schema (`db:push`); the webhook persists
  entitlement there, and without it everyone reads as free.

See `.env.example` for the full set. None of this is built further while the tier is deferred (see
`docs/decisions.md`).

## Secondary opportunities

Ordered by fit, not by size.

**1. Paid API access to the pricing catalogue.** The dated, normalised, multi-provider price table
with cache and batch rates is genuinely tedious to maintain, and other tools need it. A JSON
endpoint at $9/month is a small, high-margin line with near-zero marginal cost — it is a static file.

**2. Sponsorship of the reference content.** The waste-pattern pages are a real resource for a
well-defined, high-value audience. An eval platform, an LLM gateway or an observability vendor is a
natural single sponsor. Tasteful, one slot, disclosed. No ad network — programmatic ads on a
developer tool earn pennies and cost trust.

**3. A one-off "prompt audit" for teams.** Some organisations will not paste a prompt into a website
and will not adopt a subscription, but will pay a few hundred dollars for a written report on their
prompt estate. Low leverage and consulting-shaped, so not a strategy — but it is real revenue from
day one and it teaches you which findings people actually act on.

**4. Enterprise self-hosting.** The whole thing is static plus a CLI, so an on-premises deployment
is genuinely trivial. Regulated buyers pay for that property.

Explicitly **not** doing: selling the agent skill as a paid downloadable asset (a folder of text
and scripts carries no enforceable licence, and a frozen download would quote a stale price table
with confidence — it ships free as a distribution channel instead; see `docs/decisions.md`),
display advertising, affiliate links to model providers (it would corrupt
the comparison table, which is the most trust-sensitive surface in the product), or selling
anonymised prompt data (there is none — prompts never leave the browser, and that is a feature worth
more than the data).

## What it costs to run

### Today, free tier, no revenue

| Line | Cost |
|---|---|
| Hosting (Vercel free / Cloudflare Pages) | **$0** |
| Bandwidth | **$0** within free-tier allowances |
| Database | **$0** — there isn't one |
| AI inference | **$0** — there is none |
| Monitoring, logging, analytics | **$0** — none collected |
| Domain | ~$12/year |
| **Total** | **~$1/month** |

The marginal cost of an additional user is a static file transfer. There is no scenario where
traffic alone creates a bill worth worrying about; if free-tier bandwidth is exceeded, the site
moves to Cloudflare Pages, where static bandwidth is unmetered.

### Once Pro exists

| Line | Cost | Scales with |
|---|---|---|
| Postgres (Neon / Supabase free tier) | $0 → ~$25/mo | Paying users, not visitors |
| Auth (Clerk / Auth.js free tier) | $0 → ~$25/mo | Paying users |
| Payment processing | ~2.9% + 30¢ | Revenue, by construction |
| Cron for regression alerts | $0 (platform cron) | Saved prompts |
| Transactional email | $0 → ~$10/mo | Alert volume |
| **Total** | **~$0–60/month** | |

The important property: **every variable cost is attached to a paying user.** Free visitors consume
static bandwidth and their own CPU. There is no path where a viral week produces a bill, which is
the failure mode that kills bootstrapped AI-adjacent products.

## Economic assumptions

1. **The audience will pay for tooling.** Engineers shipping LLM features have budget and buy
   developer tools. $19/month is below most discretionary thresholds.
2. **Cost pain is real and rising.** Teams are running production LLM features with meaningful
   monthly spend and little visibility into it. If inference gets cheap enough to stop mattering,
   this product's urgency fades — the main external risk.
3. **CI enforcement is the recurring hook.** The one-time audit is the marketing; the budget is the
   product. If nobody adopts the CI check, conversion will be poor and the pricing model is wrong.
4. **Free-tier limits are visible and reasonable.** Three saved prompts is enough to feel useful and
   not enough for a team. Testable.
5. **~1–2% conversion from an engaged free user.** Typical for a developer utility with a genuine
   paid tier. At 5,000 monthly actives that is 50–100 subscribers, roughly $1,000–2,000 MRR against
   costs under $100.
6. **One operator can maintain it.** The recurring obligation is a monthly price check. Everything
   else is optional.

## When infrastructure starts to cost real money

Not at 10,000 visitors a month. Not at 100,000. The static architecture means the first meaningful
bill arrives when **paid features ship**, and that bill is bounded by paying-customer count rather
than traffic.

The one thing that would break this model is adding runtime AI inference to the free tier. It is
deliberately not there, and the roadmap keeps any model-assisted analysis inside Pro, where the cost
lands on a customer who is already paying.

## Revenue against cost, in one line

Costs scale with **paying users**; value scales with **the customer's own LLM bill**. A customer
spending $8,000 a month on inference is being sold a $19 tool against a demonstrated four-figure
saving. That ratio is the business.
