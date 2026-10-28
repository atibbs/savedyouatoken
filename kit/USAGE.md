# Usage

The kit runs one tool, always at its current version:

    npx savedyouatoken@latest

Nothing is installed globally; `npx` fetches the latest published version each time, so the pricing
and token counts are current. Requires Node 20 or newer. Every release is published from the public
repository by GitHub Actions with npm provenance, so each version on npm links to the exact commit
that built it.

## Find what to audit

    npx savedyouatoken@latest discover

Lists the agent-instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SYSTEM.md`), `*.tools.json`
tool schemas and prompt-named `.txt` / `.prompt` files in the repository, and explains anything it
skipped. Skill files, Cursor rules and Copilot instructions are not discovered automatically; list
them yourself.

## Pick a model

    npx savedyouatoken@latest models

Prints every model the tool can price, with its current rates. Use the id exactly as shown.

## Audit a file

    npx savedyouatoken@latest system-prompt.txt --model <model-id> --requests <per-day>

- `--model`: the model you actually run.
- `--requests`: how many times a day you send this prompt; the cost is projected from it.
- `--tools tools.json`: the tool / function definitions you pass to the API. In your own API calls
  these are re-sent on every request and are often the biggest single cost.
- `--output-tokens <N>`: your average completion length, so the report can tell you when *output*,
  not the prompt, is the real problem.
- `--cache-hit-rate <0-100>`: how often your requests hit the prompt cache. It defaults to 0, which
  overstates the bill if you already cache.

Point it at more than one file at once, and include your agent's own config (`AGENTS.md`,
`CLAUDE.md`, MCP tool definitions, skill files): that is prompt text too.

A note on agent tools: many coding agents now defer MCP tool definitions, sending only names until a
tool is used. For tools your *agent* loads, treat the audited tool cost as an upper bound. For tools
your *application* sends to an API, it is the real cost.

## Read the output

You get a ranked list of findings, each priced per month at your volume, plus:

- the single biggest opportunity, called out separately;
- a safe, lossless rewrite (apply it in place with `--fix`, and read the diff first);
- what the same prompt would cost on other models.

## Enforce it in CI

The quick gate is a fixed budget:

    npx savedyouatoken@latest prompts/*.txt --max-tokens 4000 --max-monthly 500

It exits non-zero when a file breaches the budget, so a pull request that bloats a prompt fails the
check.

To catch gradual growth instead, commit a baseline and a policy, then check against them:

    npx savedyouatoken@latest baseline create <file> --workflow <id> --out savedyouatoken.baseline.json
    npx savedyouatoken@latest policy generate --baseline savedyouatoken.baseline.json --out savedyouatoken.policy.json
    npx savedyouatoken@latest policy check <file> --policy savedyouatoken.policy.json --baseline savedyouatoken.baseline.json

Policies warn by default; generate with `--enforcement fail` to block the merge. Read the generated
policy before committing it, since its budgets are starting suggestions.

Run `npx savedyouatoken@latest --help` for the complete list of commands and options.

## Prompts built at runtime

If your application assembles its prompt in code, a file audit only sees the pieces. The SDK,
`@savedyouatoken/sdk`, wraps your Anthropic or OpenAI client and audits the real request in your own
process. No prompt text leaves it.

## A note on the numbers

Token counts are exact for OpenAI models the offline tokenizer supports, and clearly-labelled
estimates for everything else, because the other providers publish no offline tokenizer. The tool
always tells you which. Confirm against your provider's own billing before making a decision that
matters.
