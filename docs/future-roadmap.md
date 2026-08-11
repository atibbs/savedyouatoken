# Future roadmap

## Next

Work that should follow the MVP directly, ordered by value.

**1. Validate the CI thesis with real teams.**
Get three or four teams running `savedyouatoken` in CI and watch where it fails or annoys them. The
entire Pro pricing model rests on the assumption that budget enforcement is worth paying for. This
is the cheapest possible test of the most expensive assumption, and it should happen before any
billing work.

**2. Multi-message and conversation analysis.**
Real applications do not send one string. They send a system prompt, few-shot turns, tool results
and history. Accept a full messages array (Anthropic and OpenAI shapes) and analyse the whole
request, including where the cache breakpoint should sit across message boundaries. This is the
largest single gap between the tool and how the API is actually used.

**3. A GitHub Action that comments on pull requests.**
The CLI already exits non-zero. The missing half is the comment: *this PR adds 340 tokens to
`support-triage.txt`, about $61 a month at your stated volume.* That comment is the product's best
advertisement and lands in front of a whole team via one adopter.

**4. An agent skill.**
A `SKILL.md` plus the published CLI, so an agent can audit prompt files as part of its normal work:
locate them (including `CLAUDE.md` and MCP tool definitions), run the analysis, apply the structural
fixes the CLI only advises on, and re-measure to prove the saving. Roughly a day's work, because the
engine already exists. Free, as distribution — see the decision log for why it is not sold as a
downloadable asset. Requires publishing the CLI to npm first.

**5. Prompt history and regression alerts.**
The first genuinely paid feature and the first that needs a server. Store prompt versions, diff any
two, price the delta, and alert when a prompt crosses its budget. Requires a database and auth — the
point at which infrastructure cost begins.

**6. Payment integration.**
Stripe checkout plus a webhook that flips an entitlement. Deliberately after (5), because there
must be something to sell.

**7. A pricing-data API.**
The catalogue is already the most tedious thing here to maintain and other tools need it. A JSON
endpoint is a static file; charging $9/month for it is close to pure margin.

---

## Later

Valuable, but not yet justified.

**Model-assisted findings, inside Pro.** An LLM pass could catch semantically redundant paragraphs
that rule-based similarity misses, and judge whether an instruction is load-bearing. Kept out of the
free tier permanently so inference cost only ever lands on a paying customer.

**Eval-aware optimisation.** The honest objection to any prompt rewrite is "does it still work?"
Letting a user attach a small eval set and reporting *cost saved and accuracy held* would close that
loop and make aggressive suggestions safe to act on. Large, and it is a different product.

**Real tokenizers for Claude and Gemini.** Currently estimated. The `TokenCounter` boundary exists
precisely so this is a one-file change if either provider publishes one.

**Framework adapters.** Point at a repository and find the prompts automatically — LangChain
templates, Vercel AI SDK calls, plain string literals. Removes the copy-paste step entirely, which is
the main friction in the CLI.

**Output-side analysis.** Output is often the larger half of the bill and the tool currently only
observes that fact. Analysing sampled completions for verbosity patterns, restated questions and
unnecessary preamble would attack the bigger number.

**Batch and provider-routing advice.** The catalogue already holds batch rates. Detecting workloads
that could tolerate asynchronous processing and quantifying the 50% saving is a small addition with a
large number attached.

**Team workspaces.** Shared prompt inventories with per-prompt ownership. Follows history and auth
naturally, and is what turns a $19 seat into a $79 team plan.

**Self-hosted enterprise build.** Already nearly free — static site plus a CLI — and regulated buyers
pay for it. Worth packaging once someone asks twice.

---

## Intentionally excluded

**An LLM proxy or gateway.** The highest-value version of this idea: sit in the request path,
compress prompts, route to cheaper models, cache responses, charge a percentage of savings. Excluded
because it is always-on infrastructure on the critical path of someone's production traffic. It needs
uptime guarantees, key custody, security review and 24/7 operations from day one — before any
revenue. A latency regression becomes the customer's outage. It is a funded startup, not a
bootstrapped one, and it directly contradicts the cost discipline this project is built on.

**Accounts on the free tier.** Nothing in the free product needs identity. Adding accounts would buy
a database, session handling, password reset, a real GDPR surface and a signup step between the
visitor and the value — in exchange for an email list. `localStorage` covers the actual need.

**Storing prompts server-side, ever, on the free tier.** "Your prompt never leaves the browser" is a
load-bearing claim that converts users who would otherwise refuse. Even opt-in storage would erode
it. Pro history is a deliberate, explicit, paid exception a customer chooses.

**Programmatic model-comparison pages.** 38 models yields 703 `X vs Y` permutations, all thin, all
near-duplicates. It would inflate the indexable page count and poison the domain's quality signal.
The comparison table on the analyser does the job better because it uses the reader's own prompt.

**Selling the agent skill as a paid downloadable asset.** Considered at the owner's suggestion and
rejected on three grounds: a skill is a folder of text and scripts with no enforceable licence, paid
skill distribution is an unproven channel, and — decisively — a frozen download would quote a stale
price table with confidence, which is worse than shipping no tool. The skill is built and given away
instead. Full reasoning in `docs/decisions.md`.

**Display advertising.** Ad-network revenue on a developer tool is pennies per thousand views and
costs the trust the product runs on. A single disclosed sponsor is acceptable; an ad network is not.

**Affiliate links to model providers.** It would corrupt the cost comparison table, which is the most
trust-sensitive surface here. A comparison that earns a commission on one outcome is not a
comparison.

**Chasing every model release.** The catalogue covers the models people actually run in production
across three providers. Adding every fine-tune, preview and regional variant multiplies maintenance
for negligible value.

**A prompt playground.** Running prompts against models would need API keys, a server and per-request
cost — and half a dozen good playgrounds already exist. This tool tells you what a prompt costs; it
is not where you write one.
