# savedyouatoken CLI

Audit prompt files locally and enforce token or monthly-cost budgets in CI. Analysis is
deterministic: the CLI makes no model call and does not upload prompt text.

```bash
npx savedyouatoken prompt.txt --model gpt-5 --requests 1000
npx savedyouatoken prompts/*.txt --max-tokens 4000 --max-monthly 500
```

Run `npx savedyouatoken --help` for all options. Product guidance is available at
<https://savedyouatoken.com/cli>; source, issues, and contribution instructions live in the
[savedyouatoken repository](https://github.com/atibbs/savedyouatoken).

Licensed under MIT. Community support is best effort.
