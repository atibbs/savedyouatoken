## Context

The CLI audits explicit files and enforces absolute budgets. The SDK now provides runtime evidence,
but no standardized path turns that evidence into repository policy. GitHub feedback must remain
prompt-free and idempotent, while repository scanning must avoid surprising audits of arbitrary
source text.

## Goals / Non-Goals

**Goals:**

- Make prompt cost changes visible and enforceable in the pull request that introduces them.
- Connect production evidence to pre-deployment policy through shared contracts.
- Preserve predictable local CLI behavior and stable automation output.

**Non-Goals:**

- Automatically rewrite advisory findings.
- Execute model calls or quality evaluations.
- Require GitHub or Monitor for local use.

## Decisions

**Use explicit discovery adapters and configuration.** Known file names, extensions, and parsers can
propose assets; users approve roots and ignore patterns. Treating every string literal as a prompt
was rejected because false positives would destroy trust.

**Commit prompt-free baselines and policies, not captured prompts.** Current files remain the source
to analyze; baselines contain result evidence and identity. Storing prompt snapshots was rejected on
privacy and merge-conflict grounds.

**Build GitHub feedback from versioned JSON output.** The action is a thin renderer and comment
updater over CLI results, preventing analysis drift. A separate JavaScript analysis implementation
inside the action was rejected.

**Use one sticky comment with stable markers.** Reruns update a comment or check summary associated
with the workflow, while file annotations are reserved for confidently attributable assets. Posting
new comments on every run was rejected as noisy.

**Evaluate compatibility before arithmetic.** Engine, contract, model, currency, catalogue, and
workload metadata determine whether a diff is exact, approximate, or invalid. Silently comparing
incompatible dollars was rejected.

## Risks / Trade-offs

- [Discovery misses framework-assembled prompts] → Document coverage and direct those users to SDK
  ingestion or explicit file configuration.
- [Committed baselines become stale] → Report source revision and catalogue age; provide deliberate
  refresh commands.
- [PR estimates are mistaken for quality evidence] → Label cost-only conclusions and link evaluation
  guidance.
- [GitHub permissions block comments] → Always preserve job summaries and CLI exit behavior as a
  fallback.

## Migration Plan

Add schema-versioned output and baseline commands without changing current flags. Introduce scanning
as an explicit command, then SDK import and policy generation. Publish the GitHub workflow last and
dogfood it in this repository. Existing direct-file CI commands remain supported throughout;
rollback removes the optional action while retaining local baseline files.
