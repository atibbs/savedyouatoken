# Cost-aware assistant rule

An always-on version of the skill, for assistants that don't load `SKILL.md` or when you want the
guidance in every session. Paste the block below into `AGENTS.md`, `CLAUDE.md`, or any assistant's
instructions file. Cursor reads `AGENTS.md` automatically, so that is the simplest home for Cursor
too.

To use a Cursor rule file instead, save it as `.cursor/rules/cost-aware.mdc` and start the file with
this frontmatter. Cursor ignores rule files without it, and `alwaysApply: true` is what makes it
apply to every chat:

    ---
    alwaysApply: true
    ---

The block is kept short on purpose: an always-on rule is itself prompt text you pay for on every
request.

---

When you change anything sent to an LLM on every request (a system prompt, few-shot examples, tool
definitions, or this project's agent configuration), consider its token cost.

- Do not estimate token counts, prices or model ids from memory. Measure with the live tool:

      npx savedyouatoken@latest <file> --model <model-id> --requests <per-day>

  `npx savedyouatoken@latest models` lists valid ids; `discover` finds the files worth auditing; add
  `--tools <file>.tools.json` for tool definitions.
- Prefer the changes the tool identifies: move static content above per-request values so it can be
  cached, minify tool schemas, cut duplicate examples, and remove filler.
- Fewer tokens is cheaper, not automatically better. Preserve meaning; leave load-bearing
  instructions in place and flag them rather than deleting them.
- To keep cost from creeping back, gate it in CI: `npx savedyouatoken@latest <file> --max-tokens <N>`
  exits non-zero when the file grows past `<N>`.
