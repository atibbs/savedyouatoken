# Product platform strategy

> **Status:** Directional product plan. This document records the product implications of the
> production SDK user journey: where adoption is painful, how the current web/CLI/SDK surfaces fit
> together, where paid tiers emerge honestly, and what the flagship product should become.

## Executive summary

savedyouatoken should be understood as a family of complementary tools built on one deterministic
cost-analysis engine:

| Surface | Primary job | Current delivery |
|---|---|---|
| Web analyser | Discover and understand prompt waste immediately | `savedyouatoken.com` |
| CLI | Audit prompt files and enforce budgets before deployment | `npx savedyouatoken` |
| Runtime SDK | Observe the request an application actually sends | `@savedyouatoken/sdk` |
| Agent kit | Teach a coding agent to run the CLI against repository files | Download containing instructions; invokes `npx savedyouatoken@latest` |

The SDK is the most strategically important **sensor** because it supplies production truth, but an
SDK alone is not the strongest flagship product. The north star is a continuous cost-governance
system powered by all three analytical surfaces:

> **savedyouatoken Monitor: continuous cost profiling and regression control for production LLM
> workflows.**

The web analyser earns attention. The CLI shifts cost review left. The SDK observes runtime
reality. A future control plane supplies the recurring value: history, deployment comparisons,
alerts, ownership, collaboration, and policy enforcement.

The durable tier boundary is therefore:

> **Free diagnoses and fixes waste locally. Paid remembers, compares, coordinates, and prevents it
> from returning.**

This preserves a genuinely useful free product while charging for stateful operational capabilities
that require infrastructure.

The intended distribution model is open analysis and instrumentation with a commercially operated
hosted control plane. The repository is still private, so this is a planned transition rather than a
current open-source claim. See [`open-source-plan.md`](open-source-plan.md) for the repository
boundary, publication safety audit, and release gate.

## The product family

### Web analyser: the front door

The browser experience answers, within seconds:

- How many tokens does this prompt and tool block consume?
- What does it cost at my workload?
- Which patterns appear wasteful?
- What can be rewritten mechanically?
- Would prompt caching or another model change the economics?

It should remain immediate, private, account-free, and complete. Its role is discovery, education,
trust, and distribution—not recurring operational monitoring.

### CLI: the pre-deployment guardrail

The CLI audits files in a repository and can fail CI when a token or cost budget is breached. It
answers:

> “Will this source-code change make a known prompt more expensive?”

The CLI is appropriate for stable assets such as prompt files, agent instructions, `CLAUDE.md`,
tool schemas, and configuration committed to a repository.

### Runtime SDK: the production sensor

The SDK wraps provider clients or observes requests directly. It answers:

> “What did the production application actually assemble and send, how often does it send it, and
> what does that workload cost?”

This matters because modern requests are assembled from templates, middleware, tools, retrieved
context, tenant settings, and framework scaffolding. There may be no single prompt file that
represents the final request.

### Agent kit: an operating guide for the CLI

The kit is not the SDK and does not contain another analysis engine. It is a set of instructions
that teaches Claude Code, Cursor, or another CLI-driven assistant to find prompt assets, run the
live CLI, apply reviewable fixes, and re-measure.

Its relationship to the CLI is intentional:

```text
/cli → a developer runs `savedyouatoken`
/kit → a coding agent runs `savedyouatoken`
```

The kit invokes `npx savedyouatoken@latest` so its pricing and rules do not become frozen inside a
download.

## The flagship north star

### Not “an SDK”

The SDK is a library and an instrumentation mechanism. It can emit excellent information, but it
does not by itself provide a complete operational experience. A customer still needs somewhere to:

- name and organize workflows;
- view provisional and mature reports;
- retain baselines;
- associate shapes with deployments;
- compare before and after;
- assign ownership;
- receive regressions and alerts;
- share results with a team; and
- turn successful optimizations into enforceable policy.

The SDK is analogous to an APM agent: strategically essential, but not the whole APM product.

### savedyouatoken Monitor

The proposed flagship is a hosted or self-hosted control plane fed by the runtime SDK and connected
to the CLI/GitHub workflow.

```text
                         savedyouatoken
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
          Discover           Prevent           Observe
        Web analyser       CLI / GitHub       Runtime SDK
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │
                     Monitor / control plane
                                │
                  History · comparisons · alerts
                   ownership · policy · governance
```

Its defining experience should be a statement such as:

> “Deployment `b792de1` increased the order-status agent’s input cost by 18%. Three tools were
> added and observed cache hits fell from 74% to 31%. At current traffic, the regression is worth
> approximately $3,800 per month.”

That is a materially stronger value proposition than either “count my tokens” or “receive an SDK
event.” It connects a production change to its financial consequence and tells the team where to
act.

### Core recurring loop

```text
Observe production
        ↓
Establish a trustworthy baseline
        ↓
Detect a new shape or cost regression
        ↓
Identify the responsible change
        ↓
Recommend and prioritize an action
        ↓
Measure the improvement
        ↓
Preserve the new baseline in CI and monitoring
```

The retention signal is not “the first report was interesting.” It is:

> “Please keep watching this for us.”

## User-journey pain points and opportunities

### 1. Production value arrives after meaningful setup

Before seeing a mature production report, a user may need to install the SDK, wrap a critical
client, choose a sink, configure masking, deploy, generate traffic, and wait for the measurement
window to mature.

**Opportunity:** create a fixture/replay onboarding path. Encourage users to pass saved request and
response objects to `auditor.observe()` and generate a first production-shaped report locally before
deploying instrumentation.

Potential command or workflow:

```bash
savedyouatoken replay request.json response.json
```

### 2. The report-consumption experience is incomplete

Today the SDK emits console, callback, file, or redacted network events. The user must decide where
those events live and how provisional reports, mature reports, and changing shapes are presented.
This is the largest gap between a useful library and a coherent product.

**Opportunity:** provide an infrastructure-free local path before building a full hosted service:

- a stable JSONL report format;
- a local report viewer;
- a CLI command that summarizes collected events;
- automatic replacement or grouping of provisional and mature reports; and
- exportable HTML or Markdown reports.

For example:

```bash
npx savedyouatoken reports ./token-audit.jsonl
```

### 3. Wrapping a provider client feels operationally risky

The code change is small but touches a critical integration. Users will question response identity,
streaming, retries, raw-response helpers, errors, tracing, concurrency, memory, and rollback.

**Opportunity:** publish a production-readiness and compatibility page containing:

- explicitly tested OpenAI and Anthropic methods;
- streaming and helper-method behavior;
- error-propagation guarantees;
- observation timing;
- memory bounds and LRU defaults;
- performance measurements;
- framework compatibility; and
- a feature-flag/kill-switch recipe.

The product should show evidence for “non-intrusive,” not merely assert it.

### 4. Masking requires knowledge the user may not yet have

A user must recognize that tenant IDs, retrieved context, or other domain-specific values are
fragmenting request shapes, then write a safe mask without merging unrelated workflows.

**Opportunity:** add diagnostic tooling without automatically applying fuzzy grouping:

- report high-cardinality shape creation;
- identify lines or regions that appear to vary;
- explain which patterns the built-in skeleton already handles;
- preview a mask against fixtures; and
- show the resulting shape keys before deployment.

An opt-in helper could look like:

```ts
const result = testMask(fixtures, mask);
```

The diagnostic may suggest similarity, but analysis grouping should remain deterministic unless the
user explicitly opts into a broader policy.

### 5. Shape hashes are not human workflow names

A hash is useful for internal identity but insufficient for ownership and operations. A team needs
to know whether a report belongs to order status, refunds, contract review, or another service.

**Opportunity:** add safe caller-supplied context:

```ts
wrapOpenAI(client, {
  workflow: 'support/order-status',
  service: 'support-api',
  environment: 'production',
  release: process.env.GIT_SHA,
});
```

Metadata included in off-process reports must be explicitly documented as customer-supplied and
potentially sensitive. Defaults should remain private and minimal.

### 6. Maturity can look like silence

After the first provisional report, users may not know whether instrumentation is working, how many
observations remain, or why a low-traffic workflow never matures.

**Opportunity:** expose measurement progress:

```text
Workload status: 12/20 observations · 3m 42s/5m minimum span
Missing: output usage on 4 streamed responses
```

Also provide clear low-traffic guidance and workload overrides.

### 7. Findings need decision context

A ranked list may contain overlapping or mutually exclusive suggestions. Users still need to judge
which change is easy, behavior-preserving, architectural, or risky.

**Opportunity:** enrich recommendations with:

| Dimension | Example values |
|---|---|
| Financial impact | Projected monthly saving |
| Effort | Low / medium / high |
| Behavioral risk | None / low / requires evaluation |
| Confidence | Measured / estimated / structural |
| Relationship | Independent / overlaps another finding |
| Fix type | Mechanical / configuration / architectural |

This turns the report into an optimization plan rather than a list of observations.

### 8. Cost reduction does not prove quality was preserved

The analyzer can prove that a prompt became smaller or cheaper, but behavioral changes still need
evaluation. “Safe” should apply only to mechanically lossless transformations.

**Opportunity:** divide changes into:

- mechanically lossless;
- structurally low-risk; and
- behavioral, requiring an eval or experiment.

Later, eval-aware optimization can report both cost movement and whether quality held. Until then,
the product should generate an experiment checklist rather than imply semantic proof.

### 9. Before-and-after comparison is not first-class

The strongest user moment is proving that an optimization reduced cost. Today a user must manually
correlate old and new shape keys, releases, traffic windows, and quality measurements.

**Opportunity:** make release-aware comparison a central Monitor feature:

```text
support/order-status · a13f92c → b792de1

Input tokens          −37.8%
Output tokens         −23.2%
Cache-hit rate        +72 points
Projected cost        −$18,400/month
```

This creates a durable record of value and a natural reason to subscribe.

### 10. The SDK-to-CLI handoff is manual

The SDK observes dynamic runtime requests, while the CLI enforces budgets on source-controlled
assets. Users need help turning a successful production baseline into a repository policy.

**Opportunity:** generate a CLI or CI recommendation from a mature SDK report:

```json
{
  "workflow": "support/order-status",
  "observedInputTokens": 3910,
  "recommendedInputBudget": 4500
}
```

The dashboard or local viewer could output a copyable GitHub Actions step.

## Areas to improve the SDK offering

Ordered by impact on adoption and retention:

1. **Workflow and release metadata** for human ownership and deployment comparison.
2. **Maturity progress events** and clearer low-traffic behavior.
3. **Local report viewer/summary** so small teams do not need observability infrastructure.
4. **Production-readiness documentation** with compatibility and overhead evidence.
5. **Mask diagnostics and fixture testing** without unsafe automatic merging.
6. **Before/after comparison primitives** in the event and report model.
7. **Generated policy recommendations** that hand proven baselines to the CLI.
8. **Framework adapters**, beginning with the most demanded runtime ecosystems.
9. **Python SDK**, because a TypeScript-only runtime product excludes a large portion of production
   LLM systems.
10. **OpenTelemetry export**, allowing prompt-free findings and metrics to flow into existing
    Datadog, Honeycomb, Grafana, or other observability stacks.

Potential packages, justified only by measured demand:

```text
@savedyouatoken/sdk          TypeScript provider instrumentation
savedyouatoken               Python runtime SDK/package
@savedyouatoken/otel         OpenTelemetry exporter
@savedyouatoken/vercel-ai    Vercel AI SDK adapter
savedyouatoken-langchain     Python/LangChain adapter
```

Avoid creating integration packages before users request them; each package creates compatibility
and maintenance obligations.

## Areas to improve the CLI offering

1. **GitHub Action and pull-request comments.** Convert a failed budget into a useful explanation:
   “This PR adds 340 tokens, approximately $61/month at the configured workload.”
2. **Repository scanning.** Locate likely prompt assets, agent instructions, tool schemas, MCP
   descriptions, and framework templates:

   ```bash
   npx savedyouatoken scan .
   ```

3. **Runtime report ingestion.** Summarize SDK JSONL or exported reports locally.
4. **Baseline configuration.** Store per-workflow budgets and workload assumptions in a checked-in
   configuration file rather than repeating flags in CI.
5. **Priced diffs.** Compare two files, commits, or branches and report the cost delta.
6. **Policy generation.** Turn a production measurement into a suggested budget configuration.
7. **Clear separation of mechanical fixes and behavioral suggestions.** Keep `--fix` conservative
   and make risk visible.
8. **Machine-readable stability.** Version the JSON/report schema so teams can depend on it safely.

The CLI should remain a separate package from the runtime SDK. Production applications should not
inherit command-line code, and CI users should not inherit provider-client wrappers. They share the
same core engine and should interoperate through stable report and policy formats.

## Tiered product plan

### Product principle

Do not paywall accuracy, privacy, supported providers, or the best findings. Users must experience a
real saving before they will trust a recurring cost-governance product.

The honest technical and commercial boundary is:

```text
Stateless, local computation → free
Stateful, hosted coordination → paid
```

### Community — free

**Purpose:** discovery, trust, local optimization, and adoption.

Include:

- the complete browser audit;
- all deterministic waste findings;
- full token and dollar calculations;
- mechanical rewrite and diff;
- cache and model comparisons;
- CLI analysis and basic CI budget exit codes;
- runtime SDK instrumentation;
- console, callback, file, and redacted-report sinks;
- provisional and mature workload measurement;
- manual/replay observation; and
- a small browser-local saved-prompt allowance.

Do not meter SDK requests. The SDK deduplicates shapes, marginal analysis cost is local, and a usage
meter would discourage complete production observation.

### Developer Pro — indicative $19/month

**Purpose:** persistence, proof, and individual workflow monitoring.

Candidate capabilities:

- hosted prompt-free report dashboard;
- named workflows and projects;
- persistent shape and baseline history;
- deployment-aware before/after comparison;
- maturity progress and missing-measurement diagnostics;
- regression alerts by email or webhook;
- GitHub pull-request comments;
- priced diffs;
- generated CI policy;
- longer retention; and
- unlimited hosted projects/saved reports within reasonable abuse limits.

Primary upgrade promise:

> “Track this improvement and alert me if the cost returns.”

### Team — indicative $79–149/month

**Purpose:** ownership and coordination across services and engineers.

Candidate capabilities:

- shared workspaces;
- multiple services and environments;
- workflow ownership;
- deployment and commit attribution;
- team-wide prompt inventory;
- Slack or Teams alerts;
- shared budgets and policy templates;
- approval or exception workflows;
- organization-level trends and verified savings reports;
- roles and basic access control; and
- longer history and retention.

The team buyer is paying to answer: who owns this regression, which deployment introduced it, what
did it cost, and did the remediation work?

### Enterprise — custom annual agreement

**Purpose:** control, compliance, and deployment flexibility.

Candidate capabilities:

- self-hosted or private-cloud control plane;
- SSO/SAML and SCIM;
- fine-grained RBAC;
- audit logs;
- configurable retention and deletion;
- private networking;
- customer-managed encryption;
- custom catalogues and negotiated model prices;
- centralized policy-as-code;
- security documentation; and
- support commitments.

Enterprise is not “more accurate analysis.” It is the ability to adopt the same analysis under
organizational constraints.

### Pricing mechanics

Prefer predictable subscriptions based on developers, workspaces, monitored workflows, retention,
and collaboration features. Avoid per-request or per-token pricing:

- savedyouatoken promises to reduce usage costs, so another usage meter is strategically awkward;
- customers may reduce instrumentation to control the bill;
- analysis is shape-deduplicated and mostly local; and
- marginal hosted cost is attached to reports and retention, not raw provider traffic.

Begin with Free and Developer Pro. Introduce Team and Enterprise only after collaboration,
governance, or deployment-control demand appears repeatedly.

## Website information architecture

### Current confusion

The site gives `/cli` and `/kit` dedicated pages, and both point toward the `savedyouatoken` npm
package. That is correct because the kit teaches an agent to run the CLI, but visitors can reasonably
conclude that the kit is the SDK or that no separate runtime SDK exists.

The runtime SDK uses a distinct package—`@savedyouatoken/sdk`—but currently lacks an equivalent
website destination and product-level explanation.

### Proposed top-level structure

| Route | User question | Primary action |
|---|---|---|
| `/` | What is wasting tokens in this prompt? | Paste and audit |
| `/sdk` | What does my production application actually send? | Install `@savedyouatoken/sdk` |
| `/cli` | How do I audit files or enforce a CI budget? | Run `npx savedyouatoken` |
| `/kit` | How can my coding agent perform the audit? | Download instructions that invoke the CLI |
| `/monitor` or `/pro` | How do we track regressions over time? | Join pilot / connect reports when available |

### Navigation language

Avoid presenting product names without their jobs. Recommended labels:

- **Web audit** — paste a prompt;
- **Runtime SDK** — observe production requests;
- **CLI & CI** — audit repository files;
- **Agent kit** — teach your coding agent; and
- **Monitor** — history and regressions, once real.

### Required `/sdk` page

The SDK page should include:

1. A direct promise: “Audit the request your application actually sends.”
2. A minimal OpenAI and Anthropic installation example.
3. An explanation of provisional versus mature workload measurement.
4. Privacy boundaries for console, callback, file, and dashboard sinks.
5. Production-safety evidence and supported method behavior.
6. A comparison with the CLI: runtime assembly versus files on disk.
7. A link to the complete SDK README and compatibility documentation.
8. A clear statement that the SDK and CLI are separate packages sharing the same engine.

### Changes to `/kit`

Add a prominent clarification near the hero:

> **The agent kit is not the runtime SDK.** It teaches Claude Code, Cursor, or another assistant to
> run the savedyouatoken CLI against files in your repository.

Retain the “launcher, not a snapshot” explanation, because invoking the live CLI is the kit’s key
design property.

### Changes to `/cli`

Add a decision link near the introduction:

> Building a live OpenAI or Anthropic application? Use the runtime SDK to inspect dynamically
> assembled production requests.

Explain that the CLI and kit use the same `savedyouatoken` package for different operators: a human
versus a coding agent.

### Cross-product comparison

Add a compact chooser to the SDK, CLI, and kit pages:

| If you need to… | Use |
|---|---|
| Audit one prompt immediately | Web analyser |
| Audit prompt files or fail CI | CLI |
| Observe assembled production requests | Runtime SDK |
| Have a coding agent find and audit repository prompts | Agent kit |
| Track history and regressions across deployments | Monitor, when available |

This comparison should also appear in the README and site footer/product navigation.

### Terminology rules

- Reserve **SDK** for `@savedyouatoken/sdk` and runtime instrumentation.
- Reserve **CLI** for the `savedyouatoken` executable/npm package.
- Describe the **kit** as instructions or an agent integration, never as a software SDK.
- Use **Monitor** or **control plane** for the future stateful product.
- Always pair a product noun with its job until user research shows the distinctions are understood.

## Validation plan before building the control plane

The journey supports tiering but does not prove willingness to pay. Validate the recurring hook with
three to five real teams before activating or expanding paid infrastructure.

Provide the proposed Pro experience manually or with lightweight tooling:

- label their workflows;
- retain periodic prompt-free reports;
- create before/after comparisons;
- notify them about one material regression;
- generate a weekly cost summary; and
- help them convert a stable result into a CI budget.

Measure:

- Did the SDK remain installed after the first audit?
- Did the workflow reach a mature measurement?
- Did the user act on a finding?
- Did quality remain acceptable after the change?
- Did the user return for the comparison?
- Did they ask for history, alerts, or additional teammates?
- Did they add the CLI or GitHub check?
- Would they pay for continued monitoring?

The strongest evidence is repeated operational use, not praise for the initial report.

## Recommended sequencing

### Phase 1 — clarify and complete the existing surfaces

1. Publish `/sdk` and update product navigation.
2. Clarify `/kit` and `/cli` with explicit package and use-case distinctions.
3. Add the cross-product chooser.
4. Publish SDK production-readiness documentation.
5. Add workflow labels, release metadata, and maturity progress.
6. Define a stable shared report/policy schema between SDK and CLI.

### Phase 2 — validate the recurring workflow

1. Recruit three to five production teams.
2. Supply a local report viewer or manually managed comparison experience.
3. Produce before/after reports tied to releases.
4. Test regression notifications and CI-policy generation.
5. Measure retention and willingness to pay.

### Phase 3 — build the smallest paid Monitor

Only after validation:

1. prompt-free report ingestion;
2. workflow history and baselines;
3. deployment comparisons;
4. regression alerts;
5. GitHub integration; and
6. simple Developer Pro billing.

### Phase 4 — team and ecosystem expansion

Based on demand:

- shared workspaces and ownership;
- Slack/Teams integration;
- OpenTelemetry export;
- Python and framework adapters;
- self-hosted deployment; and
- enterprise identity and governance.

## Strategic boundaries

Do not turn savedyouatoken into an inline LLM proxy or a generic observability platform without a
deliberate change in company strategy.

An inline proxy introduces critical-path latency, API-key custody, uptime obligations, security
reviews, and around-the-clock operations. A generic observability platform dilutes the product’s
sharp differentiation and places it against mature vendors.

The focused category is:

> **Cost attribution and regression control for the structure of LLM requests.**

savedyouatoken should integrate with general observability systems while owning the specialized
analysis, financial explanation, optimization proof, and policy loop.

## Final direction

The SDK is the keystone package because it observes production reality. The CLI is the prevention
surface, the web analyser is the acquisition surface, and the kit is an agent-operated distribution
layer over the CLI.

The product north star is not any one package. It is the closed loop they enable together:

```text
Confidence → visibility → action → proof → control
```

If savedyouatoken owns that complete journey, it graduates from a useful prompt analyzer into a
credible production cost-management system for LLM applications.
