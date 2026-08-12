# Cost-Aware Agent Kit

A tiny kit that makes your coding agent — Claude Code, Cursor, or any CLI-driven assistant — audit
what its LLM prompts actually cost, and cut the waste.

It is a **launcher, not a snapshot**: everything here runs the live tool

    npx savedyouatoken@latest

so the token counts, model prices, and findings are always current. This kit embeds none of them, so
it never goes stale.

## What's inside

- **`SKILL.md`** — a Claude Code skill: audit prompt files (including the agent's own `CLAUDE.md`, MCP
  tool definitions, and skill descriptions), apply the safe fixes, and re-measure to prove the saving.
- **`cursor-rules.md`** — a paste-in rule for Cursor, or a `CLAUDE.md` block, that keeps an assistant
  cost-aware.
- **`USAGE.md`** — how to run it and read the output.
- **`CHEAT-SHEET.md`** — the waste patterns to recognise, one line each.
- **`LICENSE`** — MIT.

## Quick start

    npx savedyouatoken@latest path/to/your-prompt.txt --model <your-model> --requests <per-day>

Point it at your system prompts, your tool-definition JSON, and your agent config. See `USAGE.md`.

---

Made by [savedyouatoken.com](https://savedyouatoken.com). Thanks for paying what you could — it keeps
this free and independent.
