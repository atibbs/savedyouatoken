# CLI regression workflow

Turns a one-time `savedyouatoken` audit into a repository-wide, pre-deployment guardrail:
discover prompt assets, commit a trusted baseline, price every later change against it, enforce
a budget in CI, and surface the result in the pull request that introduced it. Everything here is
deterministic, local, and prompt-free — see [`docs/contracts.md`](contracts.md) for the underlying
report/baseline/policy contracts this workflow is built on.

## Backward compatibility

Nothing here changes the CLI's existing behavior. `savedyouatoken <file...>` and
`savedyouatoken models` — including `--json`, `--contract-json`, `--max-tokens`, `--max-monthly`,
`--fix`, and every existing flag — are unchanged; `packages/cli/test/cli.integration.test.ts`
asserts the legacy `--json` shape carries no `contract` field and reruns the default command
byte-for-byte. The `discover`, `baseline`, `compare`, `policy`, and `import-report` commands are
strictly additive: existing CI invocations, scripts, and JSON consumers keep working with no
changes.

## Machine output

Every new command's `--json` output is a schema-versioned envelope — `{ schema, version, ... }` —
independent of the `contract.version` on any report/baseline/policy document it carries:

| Command | `schema` |
| --- | --- |
| `discover --json` | `savedyouatoken.cli/discovery` |
| `compare --json` | `savedyouatoken.cli/compare` |
| `policy check --json` | `savedyouatoken.cli/policy-check` |

A compatible release may change human-readable wording freely; a documented machine consumer
should only ever need to branch on `schema`/`version`, never on terminal text.

## 1. Discover repository assets

```bash
npx savedyouatoken discover [roots...] [--config <path>] [--json]
```

Scans for known filenames and extensions only — `AGENTS.md`/`CLAUDE.md`-style agent instructions,
`*.tools.json` tool schemas, and prompt-named `.txt`/`.prompt` files — never by grepping arbitrary
source for prompt-shaped text. Every candidate is reported as `included`, `ambiguous`,
`unsupported`, or `excluded` with a reason; nothing is silently audited. A plain `.txt` file with
no "prompt" in its name is deliberately `ambiguous` — list it explicitly rather than renaming it,
or add it to a config.

Configure roots and extra ignore patterns in `savedyouatoken.discovery.json` at the repository
root:

```json
{ "roots": ["apps", "prompts"], "ignore": ["**/*.snapshot.json"] }
```

Discovery is informational: it never automatically feeds `baseline`/`policy check`, which always
take an explicit file.

## 2. Create a baseline

```bash
npx savedyouatoken baseline create <file> --workflow <id> --out savedyouatoken.baseline.json
```

Writes a **baseline bundle** — a committable, prompt-free JSON file pairing an immutable
`BaselineDocument` pointer (a `reportId` content hash) with the full `ReportEnvelope` it points to.
Core only defines the pointer; the CLI's bundle is what lets `compare`/`policy check` resolve that
hash back to a real report from one file. `readBaselineBundle` re-derives the report's content
identity on every read and refuses a bundle whose embedded report was hand-edited after the fact.

A baseline represents exactly one workflow — pass exactly one file. Commit the bundle.

## 3. SDK report handoff

Import an already-captured, versioned report — typically the SDK's `event.portableReport`,
redirected to a file — instead of auditing a file directly:

```bash
npx savedyouatoken import-report ./production-report.json      # validate and inspect
npx savedyouatoken baseline create --from-report ./production-report.json --out savedyouatoken.baseline.json
npx savedyouatoken policy generate --from-report ./production-report.json --out savedyouatoken.policy.json
```

`policy generate --from-report` requires `maturity.state === 'mature'` (real production evidence,
not a single request) and refuses a provisional report unless you pass `--allow-provisional`.
`baseline create --from-report` has no such requirement — a baseline is just an identity pointer,
so provisional evidence is fine as a starting point.

## 4. Generate and review a policy

```bash
npx savedyouatoken policy generate --baseline savedyouatoken.baseline.json --out savedyouatoken.policy.json
```

Absolute budgets (`maxInputTokens`, `maxMonthlyCost`) default to 10% headroom over the source
report's own totals; regression budgets (`maxTokenRegressionPercent`, `maxCostRegressionPercent`,
10% by default) only exist when a `--baseline` is given. `enforcement` defaults to `warn`. **Every
default is a starting suggestion — read the written file and adjust it before committing it.**

## 5. Compare and enforce in CI

```bash
npx savedyouatoken compare <file> --baseline savedyouatoken.baseline.json          # informational, no policy
npx savedyouatoken policy check <file> --policy savedyouatoken.policy.json --baseline savedyouatoken.baseline.json
```

`compare` prices the exact change — token, cache, and monthly-cost deltas, plus which findings are
new, resolved, or changed — without enforcing anything. `policy check` is the CI gate: it exits
`0` for `pass` or `warn`, and `1` for `fail`. A malformed policy/baseline, a policy that references
a different baseline than the one supplied, or an incompatible comparison (different model,
workflow, or contract major) exits `2` — a configuration problem, not a budget breach.

`diff.compatibility.status` is `exact`, `approximate`, or `invalid` (see `classifyReportCompatibility`
in `docs/contracts.md`). An `invalid` comparison — different model, workflow, currency, or contract
major — is refused outright rather than producing a misleading number; `approximate` still computes
the delta but flags the reasons (different engine version, provisional evidence, and so on) so the
number is read as directional, not exact. Token, cache, and cost deltas are computed directly from
each report's own exact totals; per-finding `monthlySaving` figures are never summed into an extra
"total savings" line, since they overlap by construction (see `packages/core/src/regression.ts`).

## 6. CI and GitHub pull-request feedback

`.github/workflows/regression-check.yml` in this repository is the reference integration,
dogfooded against the non-sensitive fixtures in `examples/.regression/`. The shape:

1. `policy check ... --json > result.json` with `continue-on-error: true`, so the job can still
   report even on a breach.
2. `node scripts/post-regression-comment.mjs result.json...` — a thin renderer over that JSON
   (never a second analysis implementation), grouped by workflow id, showing outcome, deltas,
   breaches, compatibility caveats, and next actions. It finds any existing comment carrying the
   `<!-- savedyouatoken:regression-report -->` marker and updates it (`PATCH`) instead of posting a
   duplicate on every rerun.
3. A final step reads `steps.check.outcome` (which `continue-on-error` preserves) to fail the job
   on a real `fail` outcome — the CLI's own exit code is always the actual gate, never the comment.

**Permissions:** the workflow declares `pull-requests: write`. GitHub still serves a read-only
`GITHUB_TOKEN` for `pull_request` runs triggered from a fork, regardless of that declaration — so a
fork PR cannot receive a comment no matter how this is configured. When posting fails for any
reason (missing token, no PR context, a rejected API call), `post-regression-comment.mjs` catches
it, writes the same report to `$GITHUB_STEP_SUMMARY`, and still exits `0`: a failed comment must
never mask or replace the real CI gate from step 3.

## Fix safety: auto-fix vs. advisory

Every rule (`packages/core/src/rules/`) is marked `autofix: true` or `autofix: false`, and every
`Finding` carries that flag through. `--fix` only ever writes mechanical, lossless edits — advisory
findings (few-shot bloat, tool-schema bloat, model/cache/context-window recommendations, and
similar judgment calls) are never applied automatically. This is enforced structurally in
`analyze()`, not by convention in each rule file: an advisory rule's edits, if it ever returned
any, are discarded before reaching the rewrite (`packages/core/test/rules.test.ts`, "fix-risk
classification"). None of `discover`, `baseline`, `compare`, or `policy` ever call `--fix` or touch
`optimizedPrompt`, so this guarantee applies uniformly across every surface in this workflow.
