---
name: prompt-cost-audit
description: Audit LLM prompt and agent-config files for token waste and cost, then cut it. Use when the user mentions prompt cost, token usage, an expensive LLM bill, trimming a system prompt, or auditing tool/MCP definitions.
---

# Prompt cost audit

Audit the project's prompts for token waste with the live, always-current tool, apply the safe
mechanical fixes, and prove the saving by re-measuring. No prices are hard-coded in this skill — the
CLI carries the current pricing catalogue, so always run it rather than quoting numbers from memory.

## When to use

- The user mentions prompt cost, token count, an LLM bill, or wants a prompt trimmed.
- Before shipping a change to a system prompt, few-shot examples, or tool / MCP definitions.

## Steps

1. **Find the prompt-bearing files.** System prompts, few-shot example files, tool / function
   definition JSON, and the agent's own configuration — `CLAUDE.md`, `.cursor/rules`, MCP tool
   definitions, and skill descriptions. All of these are re-sent on every request and grow by
   accretion, and almost nobody has priced them.
2. **Audit each with the live CLI:**

       npx savedyouatoken@latest <file> [<file> ...] --model <your-model> --requests <per-day>

   Attach tool definitions with `--tools tools.json`. Run `npx savedyouatoken@latest --help` for the
   full options.
3. **Read the findings.** Each is ranked and priced per month. Note the single biggest opportunity,
   and whether *output* (not the prompt) is most of the bill — if so, trimming the prompt will not
   help much and you should say so.
4. **Apply the safe fixes.** Use `--fix` for the lossless rewrite, or make the structural changes the
   tool identifies (move static content above per-request values so it can be cached; minify tool
   schemas; cut duplicate examples). Keep changes small and reviewable.
5. **Re-measure and enforce.** Re-run to prove the saving, then stop it regrowing with a budget:

       npx savedyouatoken@latest <file> --max-tokens <N>

   exits non-zero over budget, which drops straight into CI.

## Rules

- Never hard-code token counts or prices; always run the CLI so the numbers are current.
- Fewer tokens is cheaper, not automatically better — preserve meaning, and flag anything
  load-bearing for human review rather than deleting it.
- Audit the agent's own configuration too: it is prompt text that ships on every request.
