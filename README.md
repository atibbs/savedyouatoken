# savedyouatoken

**Find the waste in your LLM prompts before your invoice does.**

MIT-licensed and open source. The hosted, stateful control plane (accounts, billing, the planned
Monitor service) is operated separately and privately — see
[`docs/community-boundary.md`](docs/community-boundary.md) for the exact public/private split.

Paste a system prompt. Get a ranked list of what is wasting tokens — each priced in dollars per
month at your real request volume — plus a rewritten version you can copy, the prompt-caching maths
for your workload, and what the same prompt would cost on every other model.

No account. No upload. No model call. The analysis is deterministic and runs entirely in your
browser, which is why it is free and why your prompt never leaves the page.

```
support-triage.txt
  1,518 input tokens · $0.0065/request · $795.21/month on Claude Sonnet 5

  high   Per-request values above your static content         $235.58/mo
         1,445 tokens of static content sit below a {{template}} variable,
         so they can never be cached.
  high   More examples than the model needs                   $125.80/mo
         7 examples, about 864 tokens (123 each).
  medium JSON indented for a human reader                      $33.09/mo
         7 JSON blocks indented for readability. Minifying is lossless.

  Safe rewrite: −253 tokens (16.7%), worth $61.56 a month.
```

---

## Why this interpretation of the domain

`savedyouatoken.com` is a pun on "saved you a click" — with *token*, the billing unit of large
language models. Nobody outside the LLM-building world says "token" casually, so the name tells you
who arrives at this domain: **people who pay for tokens.**

"Saved" is also a past-tense claim of a completed benefit. A product here should be able to end an
interaction by telling you a number. That rules out the literal reading — a cache of pre-generated
AI answers, which is exactly the low-value content search engines demote, needs continuous inference
spend, and is worse than just asking a model yourself. It points instead at a tool that audits what a
prompt costs and hands back the saving.

Six interpretations were evaluated and scored before this one was chosen.

## Who it is for

The engineer who owns an LLM feature in production at a startup or small team — the person who gets
asked *"why did our Anthropic bill double last month?"* and has a system prompt that grew by
accretion over six months and has never been audited.

Secondarily, indie developers and agencies shipping AI features on thin margins, who feel token cost
directly.

## What it does

### Product family

Choose the surface by where the prompt exists and who should run the audit:

| Need | Surface | Package or action | Availability |
|---|---|---|---|
| Audit one prompt in a browser | **Web analyser** | Open `/` | Available |
| Observe the fully assembled request in a live app | **Runtime SDK** | `npm install @savedyouatoken/sdk` | Available |
| Audit files locally or enforce a pull request budget | **CLI** | `npx savedyouatoken` | Available |
| Let a coding agent audit repository prompt files | **Agent kit** | Instructions that invoke `savedyouatoken` | Available |
| Track costs and regressions over time | **Monitor** | No public action yet | Planned |

The CLI and runtime SDK are separate npm packages. The agent kit is not the runtime SDK: it is a
set of instructions that makes a coding agent invoke the current CLI package.

**Web analyser** (`/`) — paste a prompt and optional tool definitions, set your model and request
volume, and get:

- Exact or clearly-estimated token counts, including what your `tools` array costs and the
  provider's own tool-use overhead on top of it
- Ranked findings across 26 waste patterns, each priced per month
- A lossless automatic rewrite with a diff, plus an opt-in aggressive mode that removes duplicated
  instructions
- A prompt-cache simulator with the breakeven maths for your reuse rate and TTL
- Every model in the catalogue priced against your prompt, with token counts recomputed per
  tokenizer family rather than copied across
- A shareable report link that contains no prompt text

**Reference** (`/waste`) — 26 pages explaining each waste pattern, generated from the same rule
objects the analyser executes, so documentation cannot drift from behaviour.

**Model prices** (`/models`) — 38 models across Anthropic, OpenAI and Google with input, output,
cache-read, cache-write, batch and long-context-tier pricing, plus worked monthly costs.

**Runtime SDK** (`npm install @savedyouatoken/sdk`) — wraps Anthropic or OpenAI clients to audit the
fully assembled request in-process after the real response returns. Prompt and tool text stay in
the process by default; development reports to the console and production defaults to silence.

**CLI** (`npx savedyouatoken`) — the same engine over files on disk, operated by a developer or CI,
with token budgets that fail a build.

**Agent kit** (`/kit`) — instructions for Claude Code, Cursor, and other coding assistants that
invoke the live `savedyouatoken` CLI over repository files.

### Findings that are not obvious

- **Cache-hostile ordering.** A cache prefix ends at the first byte that changes, so today's date on
  line three can cost you the cache on four thousand tokens below it.
- **Tokenizer family shifts.** Claude models from Opus 4.7 onward produce roughly 30% more tokens for
  identical text. Migrating raised your token count without a single prompt edit.
- **Tool-definition overhead.** Tool schemas are re-sent on every request, plus a provider system
  prompt of 286–804 tokens you never see. In the bundled example, a 60-token prompt carries 1,108
  tokens of tool overhead.
- **Output dominance.** When output is most of your bill, the tool says so instead of selling you a
  prompt rewrite that cannot help.

## Technology

| Layer | Choice | Why |
|---|---|---|
| Engine | TypeScript, zero runtime dependencies | Shared verbatim by web, CLI and tests |
| Web | Next.js 16 (App Router), React 19, Tailwind v4 | Every route prerendered to static HTML |
| Tokenizer | `gpt-tokenizer` (o200k_base), injected | Exact for OpenAI; core stays dependency-free |
| CLI | tsup bundle, Node 20+ | One runtime dependency |
| Tests | Vitest, 58 tests | Cost maths, every rule, diff, share codec |
| Hosting | Any static host | No server, no database, no keys |

Full detail in [`docs/architecture.md`](docs/architecture.md).

## Install

Requires Node 20.9 or newer.

```bash
git clone <this repo>
cd savedyouatoken
npm install
```

## Local development

```bash
npm run dev
```

Opens the app on http://localhost:3000.

```bash
npm test                 # core engine test suite
npm run typecheck        # all workspaces
npm run build            # production build of the web app
npm run build:cli        # build the CLI to packages/cli/dist
```

### Using the CLI locally

```bash
npm run build:cli
node packages/cli/dist/index.js examples/support-triage.txt \
  --model claude-sonnet-5 --requests 4000 --output-tokens 350
```

Sample prompts live in [`examples/`](examples). They are illustrative prompts written for this
tool — realistic in shape, but not anyone's real prompt.

```bash
# Enforce a budget; exits 1 when breached
node packages/cli/dist/index.js examples/*.txt --max-tokens 4000 --max-monthly 500

# List models and prices
node packages/cli/dist/index.js models

# Rewrite in place (read the diff before committing)
node packages/cli/dist/index.js examples/support-triage.txt --fix
```

## Environment variables

There are none required. The application runs with no configuration, no API keys and no accounts.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | No | `https://savedyouatoken.com` | Canonical URLs, sitemap, share links |

Payment integration is **not part of this repository** — the checkout, billing, and account code
that would need `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` lives in the private
`savedyouatoken-cloud` repository, not here. No secrets are committed to this repository.

## Deployment

Recommended: **Vercel free tier**.

- Root directory: `apps/web`
- Build command: `npm run build`
- Install command: `npm install` (run from the repo root so workspaces resolve)
- Environment: optionally set `NEXT_PUBLIC_SITE_URL`

Every route is prerendered, so Cloudflare Pages, Netlify, GitHub Pages or an object store behind a
CDN all work equally well. There is no server component to host and no database to provision.

Do not deploy without first verifying the prices in `packages/core/src/models.ts` and updating
`PRICES_VERIFIED_ON` — the dates are shown to users.

## Repository layout

```
packages/core/     Analysis engine: pricing, cost maths, 26 rules, tests
packages/cli/      npx savedyouatoken — CI budgets, --fix, --json
packages/sdk/      In-process runtime capture for Anthropic and OpenAI clients
apps/web/          Next.js site: analyser island + static content
examples/          Sample prompts for the CLI and the web examples
docs/              Architecture, contracts, and publication process
```

## Documentation

- [Architecture](docs/architecture.md) — components, data model, tradeoffs, price maintenance
- [SDK user story](docs/sdk-user-story.md) — end-to-end production adoption and cost-reduction scenario
- [Portable contracts](docs/contracts.md) — versioned reports, baselines, policies, compatibility, and privacy
- [Open-source transition plan](docs/open-source-plan.md) — public/private boundaries, publication
  phases, safety audit and release gate
- [Community boundary](docs/community-boundary.md) — path-by-path publication classification and
  private control-plane extraction targets
- [Community development](docs/community-development.md) — fresh-clone verification, local-only
  operation and release boundaries
- [Repository-owner publication checklist](docs/community-publication-owner-checklist.md) — external
  decisions, settings, rights checks, and final launch approvals required from the owner

## Community

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Community support is best effort
and scoped in [SUPPORT.md](SUPPORT.md). Report vulnerabilities privately according to
[SECURITY.md](SECURITY.md). Project decisions follow the lightweight maintainer model in
[GOVERNANCE.md](GOVERNANCE.md), and participation is governed by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## A note on the numbers

Token counts are **exact** for OpenAI models and clearly-labelled **estimates** for Claude and
Gemini, because no public offline tokenizer exists for either. Prices are maintained by hand and
dated in the interface. Per-finding savings are attributions and can overlap, which is why the
headline reports the exact rewrite saving and the largest single opportunity separately rather than
summing everything into one inflated number.

The reasoning behind every figure is on the site at `/methodology`.

## License

MIT.
