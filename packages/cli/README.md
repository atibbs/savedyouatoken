# savedyouatoken CLI

Audit prompt files locally and enforce token or monthly-cost budgets in CI. Analysis is
deterministic: the CLI makes no model call and does not upload prompt text.

```bash
npx savedyouatoken prompt.txt --model gpt-5 --requests 1000
npx savedyouatoken prompts/*.txt --max-tokens 4000 --max-monthly 500
```

Run `npx savedyouatoken --help` for all options.

For a repository-wide regression workflow — discovering prompt assets, committing a baseline,
generating a policy, and enforcing it with pull-request feedback in CI — see
[`discover`, `baseline`, `compare`, `policy`, and `import-report`](https://github.com/atibbs/savedyouatoken/blob/main/docs/cli-regression-workflow.md).

For a local, account-free history of reports — workflow/release browsing, before/after
comparison, and baseline/policy export from a browser — run `npx savedyouatoken workbench start`;
see [the local monitoring workbench guide](https://github.com/atibbs/savedyouatoken/blob/main/docs/local-monitoring-workbench.md).

Product guidance is available at <https://savedyouatoken.com/cli>; source, issues, and
contribution instructions live in the
[savedyouatoken repository](https://github.com/atibbs/savedyouatoken).

Licensed under MIT. Community support is best effort.
