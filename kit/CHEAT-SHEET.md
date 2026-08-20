# Prompt waste cheat-sheet

The patterns the tool looks for. Run `npx savedyouatoken@latest <file>` to find which ones are in your
prompt and what each costs you — this list is the *what to recognise*, the CLI is the *how much*.

## Caching

- **Per-request values above your static content** — a cache prefix ends at the first byte that
  changes. Anything after it pays full price forever. Put the date/tenant/variable line *last*.
- **A cacheable prompt, uncached** — reading a cached prefix costs a fraction of sending it again.
- **A one-hour cache for a five-minute workload** — longer cache lifetimes cost more to write; they
  only pay back if you actually reuse them.

## Model choice

- **This model counts your prompt differently** — the same text is not the same number of tokens on
  every model; an upgrade can raise your bill silently.
- **A pricing cliff** — some models jump their input price above a prompt-size threshold.
- **Running out of room** — a prompt filling most of the context window leaves nothing for the
  conversation.
- **A newer model at a lower price** — some upgrades are strictly cheaper. Free money.
- **Your prompt is not the problem** — when output is most of the bill, trimming the prompt is
  rearranging deck chairs.

## Tools & schemas

- **What your tools cost before anyone calls one** — tool schemas are re-sent on every request, plus a
  provider system prompt you never see.
- **Tool schemas carrying dead weight** — long descriptions, JSON Schema boilerplate, and enums with a
  hundred values.

## Structure

- **The same rule, stated twice** — prompts grow by accretion; instructions get re-added, not edited.
- **More examples than the model needs** — few-shot examples are the most expensive content in most
  prompts, and they have a ceiling.
- **A long list of things not to do** — prohibitions accumulate one incident at a time.
- **A JSON schema written out in English** — declaring your output shape costs less than describing it,
  and works better.
- **Encoded data pasted into the prompt** — base64 and data URIs tokenize terribly.
- **JSON indented for a human reader** — pretty-printing adds whitespace nobody reads.

## Wording

- **Politeness aimed at a billing meter** — "please", "thank you", "I would like you to" cost tokens
  every request, forever.
- **A role that describes nothing** — "you are a helpful AI assistant" tells the model nothing.
- **Long ways of saying short things** — "due to the fact that" is four tokens; "because" is one.
- **Prompt folklore** — tips, deep breaths, dying grandmothers. Rent on a 2023 blog post.
- **Shouting is billed by the letter** — ALL-CAPS splits into more tokens than title case.
- **Smart quotes from a word processor** — curly quotes and em dashes cost several tokens each.
- **ASCII art in a paid channel** — rows of equals signs are for humans, not the model.
- **Whitespace you are paying to store** — trailing spaces and stacked blank lines are billable.
- **Markdown tables padded for alignment** — column alignment is whitespace, and whitespace is tokens.
- **Chat pleasantries in a system prompt** — sign-offs written for a human conversation.
