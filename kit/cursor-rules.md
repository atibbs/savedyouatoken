# Cost-aware assistant rule

Paste this into a Cursor rule (`.cursor/rules/*.mdc`), a `CLAUDE.md`, or any assistant's
system/instructions file. It keeps the assistant mindful of what prompts cost and points it at the
live tool instead of guessing.

---

When you touch anything that is sent to an LLM on every request — a system prompt, few-shot
examples, tool / function definitions, or this project's own agent configuration — consider its
token cost.

- Do not estimate token counts or model prices from memory. Measure with the live tool:

      npx savedyouatoken@latest <file> --model <model> --requests <per-day>

  Add `--tools tools.json` for tool definitions.
- Prefer the change the tool identifies: move static content above per-request values so it can be
  cached, minify tool schemas, cut duplicate examples, and remove filler.
- Fewer tokens is cheaper, not automatically better. Preserve meaning; leave load-bearing
  instructions in place and flag them rather than deleting them.
- To keep cost from creeping back, add a budget in CI: `npx savedyouatoken@latest <file>
  --max-tokens <N>` exits non-zero when the file grows past `<N>`.
