# Cost-Aware Agent Kit

A tiny kit that makes your coding agent — Claude Code, Cursor, Codex, or any CLI-driven assistant —
audit what its LLM prompts actually cost, and cut the waste.

It is a **launcher, not a snapshot**: everything here runs the live tool

    npx savedyouatoken@latest

so the token counts, model prices, and findings are always current. This kit embeds none of them, so
it never goes stale.

## What's inside

- **`SKILL.md`** — an Agent Skill: audit prompt files (including the agent's own `AGENTS.md` /
  `CLAUDE.md`, MCP tool definitions, and skill files), apply the safe fixes, and re-measure to prove
  the saving. Claude Code, Cursor and Codex all load it.
- **`cursor-rules.md`** — a short always-on rule to paste into `AGENTS.md`, `CLAUDE.md` or a Cursor
  rule, for assistants that don't load skills or when you want the guidance in every session.
- **`USAGE.md`** — how to run it and read the output.
- **`CHEAT-SHEET.md`** — the waste patterns to recognise, one line each.
- **`LICENSE`** — MIT.

## Install the skill

Put `SKILL.md` in a folder named `prompt-cost-audit`, inside your agent's skills directory:

- **Claude Code:** `.claude/skills/prompt-cost-audit/SKILL.md` in the project, or
  `~/.claude/skills/prompt-cost-audit/SKILL.md` for every project.
- **Cursor:** `.cursor/skills/prompt-cost-audit/SKILL.md`. Cursor also reads `.claude/skills/`.
- **Codex:** `.codex/skills/prompt-cost-audit/SKILL.md`.

The agent picks the skill up when you mention prompt cost, or you can invoke it by name. In Claude
Code the skill pre-approves only the `npx savedyouatoken@latest` command, for the turn it runs in;
every other tool still follows your normal permission settings.

## Quick start

    npx savedyouatoken@latest discover
    npx savedyouatoken@latest path/to/your-prompt.txt --model <model-id> --requests <per-day>

`discover` finds your prompt and agent-config files; `models` lists valid model ids. See `USAGE.md`.

---

Made by [savedyouatoken.com](https://savedyouatoken.com). Thanks for paying what you could — it keeps
this free and independent.
