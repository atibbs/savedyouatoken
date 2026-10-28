---
name: prompt-cost-audit
description: Audit LLM prompt and agent-config files for token waste and cost, then cut it. Use when the user mentions prompt cost, token usage, an expensive LLM bill, trimming a system prompt, or auditing tool/MCP definitions, CLAUDE.md, AGENTS.md or skill files.
license: MIT
allowed-tools: Bash(npx savedyouatoken@latest *)
---

# Prompt cost audit

Measure the project's prompts with the live CLI, apply the safe fixes, and prove the saving by
re-measuring. This skill embeds no prices and no model list. The CLI carries the current catalogue,
so always run it rather than quoting numbers from memory.

## When to use

- The user mentions prompt cost, token count, an LLM bill, or wants a prompt trimmed.
- Before shipping a change to a system prompt, few-shot examples, tool definitions, or agent
  instructions.

## Steps

1. **Find the prompt-bearing files.**

       npx savedyouatoken@latest discover

   It lists agent-instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SYSTEM.md`),
   `*.tools.json` tool schemas, and prompt-named `.txt` and `.prompt` files, and says why it
   skipped anything else. It does not pick up `SKILL.md` files, `.cursor/rules/*.mdc` or
   `.github/copilot-instructions.md`, so pass those explicitly. If the project builds its prompts
   in code at runtime, a file audit only sees fragments: suggest the SDK
   (`@savedyouatoken/sdk`), which audits the real outgoing request.

2. **Pick the model id.** Run `npx savedyouatoken@latest models` and use the id that matches what
   the project actually calls. Never guess an id; an unknown one is an error.

3. **Audit each file.**

       npx savedyouatoken@latest <file> [<file> ...] --model <model-id> --requests <per-day>

   - `--tools <name>.tools.json` adds the tool definitions sent with the request.
   - `--output-tokens <n>` sets the average response length.
   - `--cache-hit-rate <0-100>` matters if the project already caches. The default of 0 overstates
     the cost for anyone who does.

   If volume or model is not in the code, ask the user, and say which values you assumed.

4. **Read the findings.** Each is ranked and priced per month. Lead with the single biggest
   opportunity, and say plainly when output, not the prompt, is most of the bill.

   Tool overhead depends on who sends the tools. In the project's own API calls, every schema is
   re-sent on every request. A coding agent's own MCP tools are different: many agents, Claude
   Code among them, can send only tool names until a tool is needed. There, treat the tool figure
   as an upper bound and suggest deferring rarely-used tools before trimming schemas.

5. **Apply the safe fixes.** `--fix` writes the lossless rewrite back to the file; show the user
   the diff. Make the structural changes the findings name (move per-request values below the
   static content so it can be cached, minify tool schemas, cut duplicate examples) in small,
   reviewable edits.

6. **Re-measure, then stop it regrowing.** Re-run the audit to show the saving. For a quick CI
   gate, `--max-tokens <n>` or `--max-monthly <usd>` exits non-zero over budget. To catch gradual
   growth against a committed baseline:

       npx savedyouatoken@latest baseline create <file> --workflow <id> --out savedyouatoken.baseline.json
       npx savedyouatoken@latest policy generate --baseline savedyouatoken.baseline.json --out savedyouatoken.policy.json
       npx savedyouatoken@latest policy check <file> --policy savedyouatoken.policy.json --baseline savedyouatoken.baseline.json

   Policies only warn by default; add `--enforcement fail` to `policy generate` to block a merge.
   Have the user review the generated policy before committing it.

## Rules

- Never quote token counts, prices or model ids from memory. Run the CLI.
- Fewer tokens is cheaper, not automatically better. Preserve meaning, and flag load-bearing
  instructions for human review rather than deleting them.
- Audit the agent's own configuration too. It is prompt text that ships on every request.
