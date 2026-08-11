# Product Discovery — savedyouatoken.com

## Reading the domain

`savedyouatoken.com` is a pun on the internet phrase **"saved you a click."** It swaps *click* for *token* — the
billing unit of large language models. The name therefore carries two overlapping promises:

1. **"I did the AI work so you don't have to."** (the literal "saved you a click" analogue)
2. **"I saved you money/effort measured in tokens."** (the cost/efficiency reading)

The name is developer-native. Nobody outside the LLM-building world says "token" casually. That is a strong signal
about who arrives at this domain: **people who pay for tokens.** That audience is small but unusually valuable —
it has budget, buys tools, and shares tools with colleagues.

The word "saved" is also a *past-tense claim of a completed benefit*. A good product here should be able to end an
interaction by telling the user a number: *we saved you N tokens / $M per month.* Any concept that cannot produce
that sentence is fighting the domain.

---

## Interpretations considered

### 1. "Saved you a click" for AI — a cache of answers to common questions

A content site publishing pre-generated LLM answers so visitors don't have to prompt a model themselves.

- **Strengths:** Trivially understandable. Infinite SEO surface. Zero interaction complexity.
- **Weaknesses:** This is exactly the low-value AI-generated content that search engines have spent years
  demoting. The value is negative-differentiated: anyone can ask a model directly, for free, and get a *better*,
  personalized answer. Requires constant content spend. Monetization is display ads at low RPM.
- **Verdict:** Rejected. It is the most literal reading and the weakest business. It also fabricates value —
  the whole premise is that a stale cached answer beats a live one, which is false.

### 2. Aggregated "so you don't have to read it" summaries (news/papers/docs)

Summarize long content — arXiv papers, changelogs, docs, terms of service.

- **Strengths:** Real utility. Shareable. Recognizable pattern.
- **Weaknesses:** Requires *ongoing per-item AI inference* → variable cost on every page, growing with traffic
  rather than with revenue. Copyright exposure on summarizing others' content at scale. Crowded
  (dozens of TLDR products). Weak defensibility. The domain fits only loosely — "token" is incidental.
- **Verdict:** Rejected primarily on cost shape: inference cost scales with traffic, revenue does not.

### 3. A token counter / model price calculator

Paste text → token count → price across models.

- **Strengths:** Very obvious. Good long-tail SEO ("claude token counter", "gpt-5 pricing calculator"). Zero
  infrastructure — pure client-side. Perfect domain fit.
- **Weaknesses:** Already a commodity. Every provider ships one. It is a *utility*, not a product: users bounce
  in 15 seconds, never return, and there is nothing to sell them. Monetization ceiling is ad pennies.
- **Verdict:** Rejected as a standalone concept — but **absorbed as a feature.** It is a great front door and a
  legitimate SEO surface; it is just not a business by itself.

### 4. A community prompt library ("here's the prompt and its output, saved you a token")

UGC where people post prompts plus the output they got.

- **Strengths:** Free content. Network effects if it works. Good sharing loop.
- **Weaknesses:** Cold-start problem is brutal, and it is a *moderation business* — spam, SEO farming, and
  low-quality submissions arrive before real users do. Outputs go stale as models change, so the archive decays.
  Monetization is ads on UGC, which is the worst version of the worst model. High operational burden for one person.
- **Verdict:** Rejected. Highest ongoing human-operations cost of any option, which the brief explicitly warns against.

### 5. An LLM proxy/router that automatically saves tokens

Sit in front of the provider API, compress prompts, route to cheaper models, cache responses.

- **Strengths:** Enormous value if it works. Charge a % of savings. Perfect name fit.
- **Weaknesses:** This is *always-on infrastructure on the critical path of someone's production traffic.* It
  needs uptime guarantees, security review, key custody, and 24/7 operations from day one — before a single
  dollar of revenue. Latency regressions become the customer's outage. Directly contradicts the cost-discipline
  and one-operator constraints. Also a crowded, well-funded category (gateways/routers).
- **Verdict:** Rejected. Right value, catastrophically wrong cost and risk shape for a bootstrapped MVP.
  Kept in the roadmap as a much-later possibility.

### 6. A token-waste analyzer for prompts — "the autopsy of your token bill" ✅

Paste a system prompt (and its tool schemas). Get back: an exact token/cost breakdown for your real workload, a
**ranked list of specific waste findings each priced in dollars per month**, a deterministic optimized rewrite with
a diff, a prompt-caching breakeven simulation, and a cross-model cost comparison.

- **Strengths:**
  - The output *is literally the domain name*: "we saved you 4,120 tokens — $2,317/month."
  - Genuinely useful and non-obvious. The high-value findings (cache-hostile block ordering, tool-schema
    overhead, tokenizer-family cost jumps between model versions) are things experienced engineers get wrong.
  - **Zero variable cost.** The entire analysis is deterministic string/BPE work that runs in the browser.
    No AI inference. Traffic is free.
  - Repeat use is structural: prompts change every week, models and prices change every month, and every new
    project starts with a new prompt.
  - Sharing is built in — a report that says "this prompt wastes $2,300/month" is a screenshot people post.
  - Monetization is unusually believable because the product denominates itself in the customer's own dollars.
    Selling a $19/month tool to someone you just showed a $2,000/month leak is an easy conversation.
  - It extends naturally into CI (a token budget that fails a pull request), which is real recurring B2B value
    rather than a subscription bolted onto a free tool.
- **Weaknesses:**
  - Narrow audience (people shipping LLM applications). Mitigated by the fact that this audience is growing fast
    and is exactly who lands on this domain.
  - Exact tokenization is only public for some model families; Claude and Gemini counts must be *estimated*.
    Handled by labelling estimates honestly and turning the tokenizer differences into a headline feature rather
    than hiding them.
  - Pricing data needs manual upkeep (roughly monthly). Acceptable: one file, one commit.
- **Verdict:** **Selected.**

---

## Why concept 6 won

Scored against the brief's criteria (1–5, higher is better):

| Criterion | #1 Answers | #2 Summaries | #3 Counter | #4 UGC | #5 Proxy | **#6 Analyzer** |
|---|---|---|---|---|---|---|
| Usefulness | 1 | 3 | 3 | 2 | 5 | **5** |
| Immediately understandable | 5 | 4 | 5 | 4 | 3 | **4** |
| Differentiation | 1 | 1 | 1 | 2 | 2 | **4** |
| Search/discovery potential | 3 | 3 | 5 | 3 | 2 | **4** |
| Repeat use | 1 | 3 | 2 | 2 | 5 | **4** |
| Sharing potential | 2 | 3 | 2 | 3 | 1 | **5** |
| Monetization potential | 1 | 2 | 1 | 1 | 5 | **4** |
| Implementation complexity (higher = simpler) | 4 | 3 | 5 | 2 | 1 | **3** |
| Infrastructure cost (higher = cheaper) | 3 | 1 | 5 | 2 | 1 | **5** |
| Independence from paid services | 2 | 1 | 5 | 3 | 1 | **5** |
| Low operational burden | 2 | 2 | 5 | 1 | 1 | **4** |
| One-person maintainable | 3 | 2 | 5 | 1 | 1 | **4** |
| **Total** | 28 | 28 | 44 | 26 | 28 | **51** |

The token counter (#3) scores well on everything cheap and badly on everything valuable — it is a feature.
The proxy (#5) scores well on everything valuable and badly on everything cheap — it is a funded startup.
The analyzer sits where the brief actually points: high value, near-zero marginal cost, one operator.

**The decisive argument** is the cost shape. Every rejected concept either burns inference on every page view
(#1, #2), has no revenue mechanism (#3), needs human moderation (#4), or requires production-grade always-on
infrastructure before revenue exists (#5). The analyzer's marginal cost per user is a static file transfer, and
its revenue mechanism is denominated in the savings it just demonstrated.

---

## What research changed

Reading current provider pricing documentation (August 2026) surfaced three facts that materially improved the
concept and are the basis of its most differentiated findings:

1. **Claude 4.7 and later use a newer tokenizer that produces roughly 30% more tokens for the same text.**
   An engineer who upgraded from Sonnet 4.6 to Opus 5 changed their token count without changing a character of
   their prompt. Almost nobody has priced this. A tool that shows the same prompt costed across tokenizer
   families is immediately useful and is not something the generic "token counter" tools do.
2. **Prompt caching has precise, checkable breakeven math** (writes cost 1.25x or 2x base input, reads cost 0.1x).
   Whether caching pays off is a function of reuse rate and TTL, and it is easy to get wrong in both directions.
   This is arithmetic — perfect for a deterministic tool.
3. **Tool definitions cost tokens on every single request**, including a per-model tool-use system prompt of
   286–804 tokens *before* your own schemas. Teams with twenty tools are often paying more for schemas than for
   their system prompt, and it is invisible in their code.
4. **Gemini's Pro tiers double the input price above a 200k-token prompt.** A prompt drifting toward that
   boundary is a cliff worth warning about.

None of these require AI inference to detect. They require correct arithmetic and current pricing data.

---

## Target user

**Primary:** the engineer who owns an LLM feature in production at a startup or small team — the person who gets
asked "why did our Anthropic/OpenAI bill double last month?" They have a system prompt that has grown by accretion
over six months and has never been audited.

**Secondary:** indie developers and agency builders shipping AI features, who feel token cost acutely because it
comes out of thin margins.

**Tertiary (front door, not the customer):** anyone searching for "token counter" or "claude pricing calculator."
They arrive for a utility and discover an audit.

---

## The smallest product that proves the thesis

A user must be able to paste a real prompt and, within seconds and without an account, see a credible,
specific, dollar-denominated list of what is wasting their money — and act on it by copying an improved prompt.

If that experience does not produce at least one "huh, I didn't know that" moment for a competent engineer, the
thesis is wrong. Everything else (accounts, CI, teams, billing) is downstream of that moment.

---

## Major assumptions

1. **Deterministic analysis is enough.** Rule-based detection can find enough real waste to be worth a user's
   time without any model call. If this is false, the cost structure collapses and the product needs inference.
2. **Estimated token counts are acceptable** for Claude/Gemini as long as they are clearly labelled as estimates
   and the *relative* comparisons are sound. Users care about "is this 5k or 50k tokens" and "is A cheaper than B."
3. **The audience will paste a prompt into a website.** Mitigated by making analysis fully client-side and saying
   so prominently — the prompt never leaves the browser. For users who still won't, the CLI is the answer.
4. **People with a token bill large enough to care will pay for CI enforcement.** The recurring value is
   preventing regression, not the one-time audit.
5. **Prices change but slowly enough** that a manually maintained, dated pricing file is honest and sufficient.
6. **Search demand for token/pricing utilities is real and reachable**, and those visitors overlap meaningfully
   with the audit audience.
