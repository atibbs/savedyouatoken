## 0. Prerequisite

- [ ] 0.1 The `publish-cli` change has landed **and the CLI is actually published** — `npx savedyouatoken@latest` resolves. The release infrastructure is merged, but the first publish is an operator step (npm account); until then the kit MUST NOT be launched (group 5). `npm view savedyouatoken` is currently E404.

## 1. Author the kit (in-repo, launcher-not-snapshot)

- [x] 1.1 Create `kit/` with a `SKILL.md` (Claude Code) that runs `npx savedyouatoken@latest` to audit prompt files — including the agent's own `CLAUDE.md`, MCP tool definitions, and skill descriptions — and re-measures after applying fixes
- [x] 1.2 Add a Cursor / `CLAUDE.md` snippet that makes an assistant cost-aware by invoking the live CLI
- [x] 1.3 Write a one-page usage guide (install, what to point it at, how to read the output) — no prices
- [x] 1.4 Write a one-page cheat-sheet of the waste patterns — evergreen (patterns, not prices), sourced from the rules' static summaries
- [x] 1.5 Add a short kit README + LICENSE; confirm every file references the live CLI and embeds no prices or catalogue data

## 2. Package + guard

- [x] 2.1 Add a script that packages `kit/` into a distributable archive for upload to Gumroad (`scripts/build-kit.mjs` → `npm run build:kit`)
- [x] 2.2 Add a guard test that fails if any catalogue model id or price-shaped token appears in the kit — scans the kit **source** (`packages/core/test/kit-guard.test.ts`, runs in `npm test`); the packaging script verifies the archive manifest matches `kit/` exactly, so the archive contains only guard-clean files

## 3. Site integration

- [x] 3.1 Add the Gumroad product URL to site config as a public value (`KIT_URL`), with an unset → "coming soon" state
- [x] 3.2 Build a static `/kit` page (what the kit is, what's inside, "name your price", a plain outbound "Get the kit" link, no third-party script) with metadata + canonical for SEO
- [x] 3.3 Add "Get the kit" CTAs on `/cli` and in the footer (via the `Kit` nav entry), matching the editorial identity
- [x] 3.4 Ensure the CTA is a plain link (no overlay JS); when the URL is unset it renders the coming-soon state

## 4. Docs

- [x] 4.1 In `docs/future-roadmap.md`, replace the "Selling the agent skill as a paid downloadable asset" exclusion with the reversal (launcher design + PWYW resolve the old objections)
- [x] 4.2 Add a `docs/decisions.md` entry recording the decision to sell the kit pay-what-you-want and why the prior objections no longer bind

## 5. Launch (blocking — operator; the capability is not done until these pass)

Requires an npm publish (group 0) and a Gumroad account, so these are operator steps performed at
launch, not in this change. The code, page, and guard above are complete and inert until then.

- [ ] 5.1 Create and configure the Gumroad product: pay-what-you-want, $0 floor + suggested tip, and upload the built archive
- [ ] 5.2 Set the Gumroad product URL in site config (`NEXT_PUBLIC_KIT_URL`) so the CTAs become live outbound links (leaving coming-soon behind)
- [ ] 5.3 Verify a real **$0** guest checkout and a real **paid** guest checkout both complete and deliver the archive, with no account required on our site

## 6. Verify

- [x] 6.1 `npm run build` succeeds; `/kit` prerenders as static; CTAs render the coming-soon state when the URL is unset and a plain outbound link when set
- [x] 6.2 `npm test` green, including the launcher-not-snapshot guard; the packaging script's manifest check covers exactly what ships
- [x] 6.3 Confirm no third-party script was added and the free path stays static (no new server route)
- [x] 6.4 Manually verify the outbound link target and that the kit archive builds reproducibly
