# Architecture

## The shape of the thing

Every page is static HTML. There is no server, no database, no queue, no cache layer and no
authentication. The entire product is a Next.js site prerendered to files, plus one client-side
island that does the analysis in the visitor's browser.

That is not minimalism for its own sake — it falls out of a product decision. The analysis is
deterministic string and arithmetic work, so there is nothing a server could do that the browser
cannot. Once that is true, every piece of infrastructure you might add is pure cost.

```
                 ┌──────────────────────────────────────────────┐
                 │  packages/core  (pure TypeScript, no deps)    │
                 │                                              │
                 │  models.ts    pricing catalogue, dated        │
                 │  tokens.ts    TokenCounter interface          │
                 │  cost.ts      rates, projections, cache sim   │
                 │  segment.ts   blocks, tools, balanced spans   │
                 │  rules/       26 detectors + their prose      │
                 │  analyze.ts   orchestration, edit conflicts   │
                 │  diff.ts      diff derived from the edit list │
                 │  report.ts    share-link codec                │
                 └───────┬──────────────────┬───────────────────┘
                         │                  │
          ┌──────────────┴─────┐   ┌────────┴──────────┐   ┌──────────────┐
          │  apps/web          │   │  packages/cli     │   │  vitest      │
          │  Next.js 16        │   │  npx savedyou…    │   │  58 tests    │
          │  browser analysis  │   │  CI budgets       │   │  heuristic   │
          │  + static content  │   │  --fix, --json    │   │  counter     │
          └────────────────────┘   └───────────────────┘   └──────────────┘
                  injects                  injects
              gpt-tokenizer            gpt-tokenizer
```

All three consumers import `packages/core` as TypeScript source. There is no build step between
them, so the website, the CLI and the test suite provably run identical logic — a finding cannot
say one thing in CI and another in the browser.

## Major components

### `packages/core` — the engine

Zero runtime dependencies, deliberately. It is the only part of the system with real logic, and
keeping it dependency-free means it is trivially testable, trivially portable, and cannot acquire
a supply-chain problem.

**`models.ts`** — the pricing catalogue. 38 models across Anthropic, OpenAI and Google with input,
output, cache-read, cache-write (5m and 1h), batch rates, long-context price tiers, context
windows, tokenizer family, and the per-model tool-use system prompt overhead. Carries a
`PRICES_VERIFIED_ON` date that is surfaced in the UI.

**`tokens.ts`** — a `TokenCounter` interface rather than a tokenizer. Core defines the contract and
ships a dependency-free heuristic; consumers inject a real byte-pair encoder. This is the single
most useful boundary in the codebase: it keeps a 2 MB vocabulary out of the core package, lets the
tests run fast without it, and means swapping in a real Claude tokenizer later is a one-file change
if one is ever published.

**`cost.ts`** — all money. Rate resolution (long-context tiers, batch discounts, cache-write
surcharges), per-request and monthly projections, and the prompt-cache simulation. The cache
breakeven derivation is asserted in tests against the provider's own published guidance.

**`rules/`** — 26 detectors. Each `Rule` carries its own detection logic *and* its reference-page
prose, so `/waste/[slug]` is generated from the same object the analyser executes. A rule and its
documentation cannot drift apart, because they are the same value.

**`analyze.ts`** — runs the rules in a fixed order and resolves conflicts: when two rules want to
edit overlapping spans, the earlier rule wins. Region-level rewrites (JSON minification, duplicate
line removal) are ordered before character-level ones so a big replacement is not shredded by a
small one.

### `apps/web` — the site

Next.js 16 App Router, Tailwind v4, TypeScript. Two kinds of page:

- **Content pages** are React Server Components with no client JavaScript at all. Waste patterns,
  model prices, methodology, pricing, CLI docs.
- **The analyser** is one client island on `/`. The page shell around it is still server-rendered
  and indexable.

Static generation covers everything, including the 26 rule pages and 38 model pages, via
`generateStaticParams`.

### `packages/cli` — the CI surface

`npx savedyouatoken prompts/*.txt --max-tokens 4000` exits non-zero over budget. Bundled with tsup,
which inlines core, so the published package has one runtime dependency (`gpt-tokenizer`).

## Data model

There is no database, so "data model" means three things:

**The pricing catalogue** — a hand-maintained TypeScript array. Versioned in git, reviewed in pull
requests, dated in the UI.

**The analysis result** — computed, never stored. `AnalysisResult` holds token counts, findings,
the rewritten prompt, cost breakdowns, the cache simulation and the model comparison.

**Browser-local state** — `localStorage` only:

| Key | Contents | Why local |
|---|---|---|
| `syat-draft` | Current prompt, tools, model, workload | Returning users should not re-paste |
| `syat-saved` | Up to 3 saved prompts | The free tier's honest limit |
| `syat-theme` | `light` \| `dark` | Set before first paint to avoid a flash |

Nothing is transmitted. There is no analytics, no error reporting, no font CDN, no third-party
script of any kind.

## Share links

Shared reports are compressed with `CompressionStream('deflate-raw')`, base64url-encoded, and put
in the URL **fragment** — the part after `#`, which browsers never send to a server.

This gets three things at once:

1. **Privacy.** The report cannot reach a server here even by accident.
2. **Zero infrastructure.** No storage, no IDs, no expiry, no abuse surface.
3. **No prompt leakage.** The payload carries counts, findings and figures — never prompt text.
   There is a test asserting exactly that.

Cost: the link is long, and it cannot be crawled or previewed. For sharing a cost report with a
colleague, that is the right trade. `/r` is `noindex` and disallowed in `robots.txt`.

## External dependencies

| Dependency | Where | Why it is acceptable |
|---|---|---|
| `next`, `react` | web | The boring choice. Static export, good SEO defaults. |
| `tailwindcss` v4 | web | No runtime cost; styles compile to CSS. |
| `gpt-tokenizer` | web, cli | MIT, pure JS, no WASM. The only way to count exactly. |
| `tsup` | cli build | Dev only. |
| `vitest` | core tests | Dev only. |

No API keys. No accounts. No paid services. There is nothing to configure to run this.

## Deployment

Vercel free tier, root directory `apps/web`, build `npm run build`. Any static host works equally
well — Cloudflare Pages, Netlify, GitHub Pages, an S3 bucket — because the output is files. That
portability is deliberate: there is no lock-in to negotiate later.

The only environment variable is `NEXT_PUBLIC_SITE_URL`, used for canonical URLs and the sitemap.
It has a sensible default and the app runs without it.

## Infrastructure characteristics

| Property | Value |
|---|---|
| Servers | None |
| Cold start | None — static files |
| Per-visit compute cost | Zero (the visitor's CPU does the work) |
| Per-visit bandwidth | ~120 KB for content pages; ~2 MB once for the tokenizer, then cached |
| Database | None |
| Scaling limit | The CDN's |
| Ops burden | Update prices monthly; nothing else |

The tokenizer vocabulary is the one heavy asset. It is code-split and fetched only once the user has
actually entered a prompt, so visitors who read a reference page and leave never download it. After
the first fetch it is served from the browser cache.

## Cost-conscious decisions

**Prices are a file, not a scraper.** A scheduled scrape means a server, a schedule, a failure mode,
a legal question, and a monitoring burden — in exchange for freshness measured in weeks on data that
changes monthly. A dated file is honest and free, and it keeps the whole site static.

**Analysis is deterministic, not model-assisted.** An LLM could probably find subtler waste. It
would also cost money per page view, cap the free tier, add latency, add a failure mode, and force
prompts through a server. The rule engine finds enough real waste to be worth someone's time, and
its cost per analysis is zero.

**No accounts.** Accounts mean a database, session handling, password reset, a privacy policy with
teeth, and a GDPR surface. The product needs none of it to deliver its core value.

**Share links in the URL, not in storage.** Removes an entire storage tier and its abuse surface.

## Technical tradeoffs

**Estimated token counts for Claude and Gemini.** No public offline tokenizer exists for either.
Accepted, and handled by labelling every number as exact or estimated and documenting the factors.
The alternative — calling a provider's token-counting endpoint — would mean API keys, a server, and
a per-request cost, which would break the entire economic model to improve a number by a few
percent.

**Rules can miss things a model would catch.** Accepted, in exchange for zero marginal cost.

**Per-finding savings can overlap.** Caching examples and deleting examples save the same tokens.
Rather than invent a resolution, the product reports the exact rewrite saving and the single largest
structural opportunity as two separate numbers, and says so in the methodology. Overstating savings
would be the fastest way to lose a technical audience.

**Core ships TypeScript source rather than compiled output.** Consumers transpile it
(`transpilePackages` in Next, tsup for the CLI). Simpler in a monorepo and guarantees all three
consumers run identical code; publishing core to npm separately would need a build step first.

**Everything is client-side, so the analyser itself is not indexable.** Deliberate: the SEO surface
is the reference and pricing content, which is fully server-rendered.

## Keeping prices honest

`PRICES_VERIFIED_ON` in `packages/core/src/models.ts` is displayed in the footer and on every model
page. To update:

1. Check the three providers' pricing pages.
2. Edit `MODELS`, add or retire entries, set `legacy` and `supersededBy` where a model is replaced.
3. Bump `PRICES_VERIFIED_ON`.
4. `npm test` — model-dependent assertions will catch a structural mistake.

`supersededBy` drives a finding that tells a user they are overpaying, so it must only point at a
model that is genuinely cheaper on both input and output within the same family. A wrong entry
there is a wrong dollar figure in front of a user, which is worse than no entry.
