# Decision log

Consequential decisions only. Implementation details live in the code.

---

## Decision: Build a prompt cost analyser, not a cache of AI answers

**Context:**
`savedyouatoken.com` is a pun on "saved you a click". The literal reading is a site that publishes
pre-generated LLM answers so visitors do not have to prompt a model. Five other readings were
evaluated (see `docs/product-discovery.md`).

**Decision:**
Build a deterministic audit of what an LLM prompt costs: priced waste findings, a lossless rewrite,
prompt-cache economics and cross-model comparison.

**Reason:**
The literal reading is the weakest business available at this domain — it is the low-value
AI-generated content search engines have spent years demoting, it needs continuous inference spend,
and its value proposition is false, since asking a model directly gives a better answer. The
analyser reading keeps the domain's promise (it ends by telling you how many tokens it saved you)
while pointing at an audience that pays for tools and a problem measured in dollars.

**Tradeoff:**
A much narrower audience. "People shipping LLM features" is a small slice of the internet compared
with "people who want an answer" — traded for the fact that this slice has budget, is reachable, and
has a problem worth money.

---

## Decision: No AI inference anywhere in the product

**Context:**
An AI agent building a product is under obvious pressure to put AI in it, and a model could
plausibly find subtler waste than a rule engine.

**Decision:**
Every one of the 26 checks is deterministic string and arithmetic work. No model is called at any
point, in any tier.

**Reason:**
Inference cost would scale with traffic while revenue scaled with conversion — the failure shape
that kills bootstrapped AI products. It would also cap the free tier, add latency, add a failure
mode, and force prompts through a server, destroying the privacy property that makes people willing
to paste in the first place. The rule engine finds enough real waste to be worth someone's time.

**Tradeoff:**
Rules miss things a model would catch — semantic redundancy across differently-worded paragraphs,
whether an instruction is load-bearing. Any model-assisted analysis is deferred to Pro, where the
cost lands on a paying customer.

---

## Decision: The entire analysis runs in the browser

**Context:**
The analysis could run server-side, which would allow exact tokenization via provider endpoints and
richer server-held state.

**Decision:**
All of it runs client-side. Every route is prerendered static HTML.

**Reason:**
Three benefits at once. **Cost:** marginal cost per user is a file transfer, so infrastructure is
~$1/month at any traffic level. **Privacy:** a prompt is often the most commercially sensitive text a
team owns, and "it never leaves your browser" converts users who would otherwise refuse. **Latency:**
results are instant.

**Tradeoff:**
The analyser itself is not indexable, and a ~2 MB tokenizer vocabulary must reach the client. The
first is handled by making the reference and pricing content the SEO surface; the second by
code-splitting it and fetching only once a prompt exists.

---

## Decision: Prices are a hand-maintained dated file, not a scraper

**Context:**
Pricing data goes stale, and stale prices in a tool whose entire output is dollar figures is a
credibility problem.

**Decision:**
One TypeScript file, `PRICES_VERIFIED_ON`, surfaced in the footer and on every model page.

**Reason:**
A scraper means a scheduled job, a server, a failure mode, a monitoring burden and a legal question,
in exchange for freshness measured in weeks on data that changes monthly. It would also make the
site non-static, which would undo the cost decision above. A dated file is honest about its own
staleness, which is better than silent staleness.

**Tradeoff:**
A recurring monthly obligation on the operator, and prices can be wrong between checks. Mitigated by
displaying the date everywhere and telling users to confirm before acting.

---

## Decision: Label estimated token counts rather than hide them

**Context:**
Only OpenAI publishes a runnable offline tokenizer. Counts for Claude and Gemini can only be
estimated, which is awkward for a tool whose credibility rests on its numbers.

**Decision:**
Show exact counts for OpenAI models and clearly-labelled estimates elsewhere, with the family
factors and their basis published on `/methodology`. Turn the difference into a feature: the
tokenizer-family finding tells users a Claude 4.7-or-later migration raised their token count ~30%.

**Reason:**
A technical audience punishes false precision far harder than acknowledged uncertainty. Presenting
estimates as exact would be the fastest way to lose them. And the honest version turned out to be
more interesting than the hidden one — the tokenizer difference is now one of the product's better
insights.

**Tradeoff:**
Some users will want exact Claude counts and will not get them. Handled at the `TokenCounter`
boundary, so a real tokenizer is a one-file change if one is ever published.

---

## Decision: Do not sum the per-finding savings

**Context:**
Adding every finding's monthly saving produces a large, attractive headline number.

**Decision:**
Report the exact rewrite saving (computed by re-counting the rewritten prompt) and the single
largest structural opportunity as two separate figures. State plainly in the methodology that
per-finding numbers can overlap.

**Reason:**
Caching a block of examples and deleting them save the same tokens. A summed total would overstate
the benefit, and the first engineer to check the arithmetic would find it. In a product whose only
asset is trust in its numbers, an inflated headline is a strategic mistake, not a marketing one.

**Tradeoff:**
A smaller headline number and a slightly more complex explanation.

---

## Decision: Share links carry the report in a URL fragment

**Context:**
Shareable reports usually mean stored records, which means a database, IDs, expiry and abuse
handling.

**Decision:**
Compress the report and put it after the `#`, which browsers never transmit. The payload carries
counts, findings and figures — never prompt text, asserted in a test.

**Reason:**
Removes a whole storage tier and its abuse surface, and makes the privacy claim structural rather
than a promise: the report cannot reach a server here even by mistake.

**Tradeoff:**
Long links, no server-side preview, and no analytics on shares.

---

## Decision: Free tier keeps every insight; the paywall is on persistence

**Context:**
The obvious freemium split is to gate the interesting findings.

**Decision:**
All 26 patterns, the full rewrite, the cache maths and the model comparison stay free forever. Pro
sells history, regression alerts, CI enforcement and team features. The free tier's only limit is
three saved prompts, enforced in code.

**Reason:**
The audit is a one-time event and makes a poor subscription; the regrowth is what recurs. The
free/paid line also coincides with the stateless/stateful line, so paid features genuinely require a
server rather than being artificially withheld. And a tool that paywalls its insight does not get
recommended — being recommended is the entire distribution strategy.

**Tradeoff:**
Slower conversion than an aggressive gate, and the free tier must be carried indefinitely at
whatever traffic arrives. Affordable precisely because the free tier costs nothing to serve.

---

## Decision: Ship a CLI alongside the web app

**Context:**
Scope pressure argued for the web app alone.

**Decision:**
Build `npx savedyouatoken` on the same core package, with `--max-tokens` / `--max-monthly` budgets
that exit non-zero.

**Reason:**
It is the concrete form of the recurring value the business depends on — a budget enforced in the
pull request where the growth happens. It also reaches the audience that will never paste a prompt
into a website, which includes some of the best customers, and npm is a distribution channel. Sharing
core made it roughly 300 lines.

**Tradeoff:**
A second surface to maintain and document. Kept cheap by having no logic of its own.

---

## Decision: Ship the agent skill free rather than selling it as a downloadable asset

**Context:**
Raised by the project owner during review: the analysis premise could be packaged as an agent
skill — a `SKILL.md` plus the bundled CLI — and sold as a downloadable asset. The build is cheap,
roughly a day, because the core is already a dependency-free library with a command-line interface.

**Decision:**
Build the skill. Ship it free as a distribution channel. Keep the paid line exactly where it already
is: the hosted, stateful features.

**Reason:**
The skill itself is a strong fit. The division of labour is unusually clean — the agent supplies the
workflow and judgement, the CLI supplies exact tokenization, current prices and multi-step
arithmetic, which are precisely the three things a language model does badly. It also lets an agent
*act on* the 14 advisory findings the CLI can only report: reordering blocks above a cache
breakpoint, moving a prose schema into a response schema, trimming few-shot examples — then
re-measuring to prove the saving.

Selling it as a download is the part that fails, for three reasons in ascending order of weight.
A skill is text and a script, so there is no meaningful way to enforce a licence on a folder that can
be read and copied, and any gate in an open-source CLI is patched out in minutes. Paid skill and
plugin distribution is an unproven channel to build a revenue plan on. And decisively: this product's
output is dollar figures drawn from a price table that changes monthly. A snapshot downloaded in
March and quoting March's prices in September is worse than no tool at all — it is a wrong number
delivered with confidence. Invoking the published CLI keeps the table current; a frozen asset cannot.

**Tradeoff:**
Forgoes a direct one-off revenue line and widens the free surface that must be maintained. Accepted
because the skill's most valuable application — auditing an agent's *own* configuration, where
`CLAUDE.md`, tool schemas and MCP definitions are re-sent on every request and nobody has priced
them — is an acquisition channel into exactly the audience that buys the subscription.

---

## Decision: Rules carry their own documentation

**Context:**
Rule definitions and their reference pages could live separately.

**Decision:**
Each `Rule` object carries `summary`, `why` and `example`, and `/waste/[slug]` renders from it.

**Reason:**
26 rules and 26 pages will drift apart if they are two things. Being one thing makes drift
impossible, and it means adding a rule automatically adds an indexable page and a sitemap entry.

**Tradeoff:**
Prose lives in the core package, which slightly muddies its purity as a logic library. Worth it.

---

## Decision: Defer the Pro tier — keep it specced, do not build the paid product yet

**Context:**
The stateful boundary for Pro was built and merged — Auth.js sessions, a Postgres/Drizzle schema
for saved prompts and entitlements, and the Stripe checkout/webhook/portal wiring — all env-gated
and inactive. The pricing page exists with an inactive checkout. The paid *features* themselves
(server-synced history, version diffing, regression alerts, the pull-request bot, a hosted
dashboard, the SDK's paid sink) are not built. The strongest case for the tier and the strongest
case against it were both worked through in full before this decision.

**Decision:**
Stop before building the paid product. Keep Pro fully specced (`docs/monetization.md`), documented
(this entry) and roadmapped (`docs/future-roadmap.md`), and leave the boundary in place, inert.
Build no Pro features, connect no billing, and invest no further in the paid tier until demand for
the recurring hook is validated with real teams.

**Reason:**
The case for Pro and the case against it converge on one crux: whether teams adopt *and retain* a
recurring cost-governance hook — the CI budget check or the capture SDK. That is unproven, and it
is structurally uncertain: cost-in-CI may lack the organisational teeth that security and
performance gates have, and the "we see real traffic" advantage the SDK leans on is exactly where an
already-installed gateway or observability incumbent is strongest. The decisive argument is
sequencing — building the paid platform spends effort on the cheap, known parts (auth, billing,
dashboard) while leaving the one expensive unknown untested. This reverses the ordering the roadmap
itself always advised (validate the CI thesis *before* billing work); the boundary was built ahead
of that evidence, and the correct response is to stop there rather than compound it.

**Tradeoff:**
The auth/DB/Stripe scaffolding sits unused — harmless because it is inert without env vars, but real
weight to keep building and reasoning around. Revenue is deferred indefinitely, and if the free tool
never converts, that scaffolding was wasted. Accepted: the boundary is left in place rather than
reverted, because activation later is a small contained step, whereas finishing Pro on faith now
risks far more than a few unused tables.

---

## Decision: Sell a pay-what-you-want agent kit (reversing the "don't sell the skill" call)

**Context:**
An earlier decision (still recorded under *Intentionally excluded* in `docs/future-roadmap.md`)
rejected selling the agent skill as a paid download on three grounds: an unenforceable licence,
paid-skill distribution being an unproven channel, and — decisively — a frozen download quoting a
stale price table with confidence.

**Decision:**
Ship a downloadable **cost-aware agent kit** (a Claude Code skill, a Cursor/`CLAUDE.md` rule, a usage
guide and a cheat-sheet), sold **pay-what-you-want** ($0 floor + tip) via Gumroad as merchant of
record. It is offered from a static `/kit` page and CTAs that are plain outbound links — no Gumroad
overlay or other cross-origin third-party script.

**Reason:**
Two of the three original objections no longer bind. The decisive one — stale prices — is dissolved
by a **launcher-not-snapshot** design: the kit embeds no prices and runs `npx savedyouatoken@latest`,
so every number is current, and a guard test fails the build if any catalogue id or price token
appears in it. Enforceability stops mattering under pay-what-you-want, which monetises goodwill and
convenience, not defensible IP. It also doubles as the cheapest willingness-to-pay signal now that
the Pro subscription is shelved, and it plants the tool inside the agents where machine-written
prompts bloat.

**Tradeoff:**
Small, uncertain revenue, and a kit whose value depends on the CLI being published and kept current
(handled by the `publish-cli` release process). Launch is gated on that publish and on creating the
Gumroad product.

## Decision: Add first-party, cookieless analytics (Vercel Web Analytics)

**Context:**
The site launched with a deliberate "no analytics, no third-party script" stance (see
`docs/architecture.md`). But operating the product needs a rough sense of traffic and whether
visitors actually use the tool and click through to the kit — signals the earlier stance left
entirely dark, forcing reliance on Gumroad/npm proxies alone.

**Decision:**
Enable **Vercel Web Analytics** (already on the hosting platform). It serves same-origin from
`/_vercel/insights`, sets **no cookies**, collects **no personal data**, and needs **no consent
banner**. Two custom events are emitted alongside pageviews: `run_audit` (once per session, on the
first analysis result) and `kit_click` (the Gumroad CTA).

**Reason:**
Chosen over GA4, which was the original request: GA4 sets cookies (a consent banner for EU/UK
visitors), ships a cross-origin third-party tracker, and would have reversed the privacy claim the
product markets. Vercel Web Analytics is first-party and cookieless, so it counts visits without a
banner and without a cross-origin tracker; crucially, **prompts still never leave the browser** —
analytics only ever sees pageview paths and two event names, never prompt or tool text.

**Tradeoff:**
It is still a script and a small telemetry stream, so the absolute "nothing is transmitted" line no
longer holds; the affected docs were updated to say so truthfully. Custom events depend on the
Vercel plan's analytics limits (pageviews work on the free tier regardless).
