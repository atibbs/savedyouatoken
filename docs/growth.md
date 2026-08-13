# Growth and distribution

## The core loop

A user pastes a prompt, sees "$795 a month, $235 of it recoverable", and screenshots it. That
screenshot is the advertisement, and it contains a specific dollar figure about a real problem
rather than a claim about a product.

Three properties make the loop work:

1. **The output is a number, not an opinion.** "Your prompt wastes $2,300 a year" travels; "prompt
   optimisation tool" does not.
2. **Sharing is frictionless and safe.** No account, and the share link provably contains no prompt
   text — so sharing a report with a colleague is not a data-handling decision.
3. **The insight is often surprising.** The tokenizer-family finding and the tool-schema overhead
   figure produce genuine "I did not know that" reactions from competent engineers. Surprise is what
   gets forwarded.

## Acquisition channels

### 1. Organic search — the durable one

Two distinct surfaces, both fully server-rendered and static.

**Reference content (26 pages).** Each waste pattern is a real explainer with a before/after and an
argument, targeting the questions people actually ask: *why is my prompt so expensive*, *does prompt
caching save money*, *how much do tool definitions cost*, *do all caps use more tokens*. These earn
links because they are the answer, not because they are optimised.

**Pricing pages (38 pages).** `claude-opus-5 pricing`, `gpt-5.6 cost per request`, and so on — high
commercial-intent, high-volume queries. These are the kind of page that is usually thin, so each one
carries something the provider's own page does not: worked monthly costs at three prompt sizes and
three volumes, prompt-cache economics with the breakeven, tokenizer family, tool-use overhead, and
cheaper same-family alternatives.

The test applied throughout: *would this page be worth reading if search did not exist?* Pages that
fail it were not built. There is no programmatic long tail of `X vs Y` combinations — 38 models
would yield 703 comparison pages, all thin, and it would poison the domain.

**Why this can win.** The pricing-calculator space is crowded but mostly stale — pages listing
last year's models with no cache rates and no batch pricing. Accurate, dated, structurally complete
pricing data is a real differentiator, and it is maintained by editing one file.

### 2. The CLI on npm

`npx savedyouatoken prompts/*.txt` is a distribution channel in its own right. npm is a discovery
surface, the package name is the domain, and a CI check that comments on a pull request puts the
product in front of an entire team via one adopter.

The CLI also converts the audience that will never paste a prompt into a website — which, for
prompts that constitute a company's actual IP, is a significant share of the best customers.

### 3. An agent skill — the channel that reaches agents, not people

Increasingly, prompts are written *by* agents rather than by hand, and nothing in that loop reports
what the resulting prompt costs. A skill closes it: the agent finds the prompt files, runs the
analysis, applies the structural fixes, and re-measures.

The sharpest version is an agent auditing its **own** configuration — `CLAUDE.md`, skill
descriptions, MCP tool definitions. All of it is re-sent on every request, all of it grows by
accretion, and almost nobody has priced it. The bundled `agent-tools` example already shows the
shape: a 60-token prompt carrying 1,108 tokens of tool overhead.

It is given away rather than sold, for the reasons in the decision log. Its job here is reach: it
puts the product in front of developers who will never visit a website, inside the tool they are
already working in. There is a design constraint worth honouring — a skill's own description costs
tokens on every request, so this one has to practise what it audits.

### 4. Communities, once

The audit report is a legitimate post in the places this audience lives: Hacker News (Show HN), the
LLM and AI-engineering subreddits, relevant Discord and Slack communities, Lobsters. These are
one-shot channels — they produce a spike, not a slope — but the spike seeds backlinks that feed
channel 1 for years.

The post that works is not "I built a tool." It is the finding: *"Claude's tokenizer changed in 4.7
and your prompt got 30% more expensive without you touching it."* That is a genuinely interesting
technical fact, the tool is the proof, and it is the kind of thing that gets discussed rather than
upvoted and forgotten.

### 5. Writing that earns links

The engine produces material that is worth publishing on its own: the tokenizer-family analysis, a
teardown of what tool schemas actually cost across providers, the cache breakeven maths worked
through properly. Each is a reference other people cite, and each already exists as a page here.

### 6. Integrations, later

Prompt-management platforms, eval tools and LLM gateways all have users with the same problem and no
good answer for it. An embeddable widget or an API-backed "cost check" is a plausible partnership —
but only after the standalone product has demonstrated pull. Integrations are a multiplier on
existing demand, not a source of it.

## SEO specifics

Implemented:

- Static prerendering of all 75 routes; content is in the HTML, not assembled by JavaScript.
- Semantic markup, real heading hierarchy, descriptive URLs (`/waste/cache-hostile-order`,
  `/models/claude-opus-5`).
- Canonical URLs on every page; per-page titles and descriptions.
- `WebApplication`, `TechArticle` and `Product` structured data.
- `sitemap.xml` generated from the model and rule catalogues, so a new model or rule is indexed
  automatically.
- `robots.txt`; `/r` is `noindex` and disallowed, because shared reports are per-user payloads.
- Internal linking: findings link to their reference page, reference pages link to related patterns
  and back to the analyser, model pages link to cheaper alternatives.
- No layout shift and no render-blocking third-party resources. The only analytics is Vercel Web
  Analytics — a small, async, same-origin, cookieless beacon that never blocks rendering. The 2 MB
  tokenizer is code-split and fetched only after a user enters a prompt, so it never affects a
  content page's load.

Deliberately not done: comparison-matrix pages for every model pair, "best prompt optimizer 2026"
listicles, or any page whose reason to exist is a query rather than a reader.

## Launch sequence

**Before launch.** Verify every price against the provider pages and set the date. Publish the
CLI to npm. Prepare the tokenizer-family write-up, since it is the strongest single hook.

**Week one.** Show HN, framed around the finding rather than the tool. Post to the AI-engineering
communities. Answer every comment, and fix what the comments surface — early technical audiences
find real bugs, and this one will check the arithmetic.

**Weeks two to six.** Publish the supporting write-ups. Ask three or four teams to run the CLI in CI
and watch where it fails or annoys them. That feedback determines whether the Pro thesis holds
before any billing work is done.

**Month two onward.** Watch which reference pages actually rank and write more in that direction.
Keep prices current — freshness is the moat on that surface, and it costs one commit a month.

## What would say this is not working

- The audit produces nothing surprising on real prompts. If competent engineers say "I knew all
  that", the rule set is too shallow and needs the harder structural detections.
- Nobody adopts the CI check. The subscription thesis rests on it; without it the product is a
  utility and should be monetised differently, or not at all.
- Reference pages get traffic but the analyser gets no use. That would mean the content is a
  standalone resource and the tool is incidental — worth knowing early, because it changes the
  business into a media one.
