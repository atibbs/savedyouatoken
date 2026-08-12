# Usage

The kit runs one tool, always at its current version:

    npx savedyouatoken@latest

Nothing is installed globally; `npx` fetches the latest published version each time, so the pricing
and token counts are current. Requires Node 20 or newer.

## Audit a file

    npx savedyouatoken@latest system-prompt.txt --model <your-model> --requests <per-day>

- `--model` — the model you actually run (see the list with `--help`).
- `--requests` — how many times a day you send this prompt; the cost is projected from it.
- `--tools tools.json` — include the tool / function definitions you pass to the API. These are
  re-sent on every request and are often the biggest single cost.
- `--output-tokens <N>` — your average completion length, so the report can tell you when *output*,
  not the prompt, is the real problem.

Point it at more than one file at once, and include your agent's own config (`CLAUDE.md`, MCP tool
definitions, skill descriptions) — that is prompt text too.

## Read the output

You get a ranked list of findings, each priced per month at your volume, plus:

- the single biggest opportunity, called out separately;
- a safe, lossless rewrite (apply it in place with `--fix` — read the diff first);
- what the same prompt would cost on other models.

## Enforce it in CI

    npx savedyouatoken@latest prompts/*.txt --max-tokens 4000 --max-monthly 500

Exits non-zero when a file breaches the budget, so a pull request that bloats a prompt fails the
check. Run `npx savedyouatoken@latest --help` for the complete list of options.

## A note on the numbers

Token counts are exact for OpenAI models and clearly-labelled estimates for others, because no public
offline tokenizer exists for them. The tool always tells you which. Confirm against your provider's
own billing before making a decision that matters.
