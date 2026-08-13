## 0. Prerequisite

- [x] 0.1 Confirm the `publish-cli` implementation has landed, npm serves `savedyouatoken@latest`, and a clean `npx savedyouatoken@latest` audit completes

## 1. Author the kit (in-repo, launcher-not-snapshot)

- [x] 1.1 Create `kit/` with a `SKILL.md` (Claude Code) that runs `npx savedyouatoken@latest` to audit prompt files — including the agent's own `CLAUDE.md`, MCP tool definitions, and skill descriptions — and re-measures after applying fixes
- [x] 1.2 Add a Cursor / `CLAUDE.md` snippet that makes an assistant cost-aware by invoking the live CLI
- [x] 1.3 Write a one-page usage guide (install, what to point it at, how to read the output) — no prices
- [x] 1.4 Write a one-page cheat-sheet of the waste patterns — evergreen (patterns, not prices), sourced from the rules' static summaries
- [x] 1.5 Add a short kit README + LICENSE; confirm every file references the live CLI and embeds no prices or catalogue data

## 2. Package + guard

- [x] 2.1 Add a script that packages `kit/` into a distributable archive for upload to Gumroad (`scripts/build-kit.mjs` → `npm run build:kit`)
- [x] 2.2 Add a guard test that fails if any catalogue model id or price-shaped token appears in the kit — scans the kit **source** (`packages/core/test/kit-guard.test.ts`, in `npm test`); `npm run build:kit` builds the archive and verifies its **contents byte-for-byte against `kit/`**, and it runs in CI, so the shipped archive is proven guard-clean

## 3. Site integration

- [x] 3.1 Add the Gumroad product URL to site config as a public value (`KIT_URL`), with an unset → "coming soon" state
- [x] 3.2 Build a static `/kit` page (what the kit is, what's inside, "name your price", a plain outbound "Get the kit" link, no third-party script) with metadata + canonical for SEO, and add it to `sitemap.ts`
- [x] 3.3 Add the `GetTheKit` action on `/cli` and **in the footer** (plus a `Kit` nav entry for discovery), matching the editorial identity
- [x] 3.4 Ensure the CTA is a plain link (no overlay JS); when the URL is unset it renders the coming-soon state

## 4. Docs

- [x] 4.1 In `docs/future-roadmap.md`, replace the "Selling the agent skill as a paid downloadable asset" exclusion with the reversal (launcher design + PWYW resolve the old objections)
- [x] 4.2 Add a `docs/decisions.md` entry recording the decision to sell the kit pay-what-you-want and why the prior objections no longer bind

## 5. Launch (blocking — operator; the capability is not done until these pass)

The public Gumroad page now confirms pay-what-you-want, a $0 floor, a $5 suggested price, and active
inventory. The live site points to that product. Archive attachment and delivery still require
operator verification inside the purchase flow.

- [x] 5.1 Create and publicly configure the Gumroad product as pay-what-you-want with a $0 floor and suggested tip
- [ ] 5.2 Confirm in the Gumroad dashboard that the current guarded archive is attached to the product
- [x] 5.3 Set `NEXT_PUBLIC_KIT_URL` so the deployed `/kit`, `/cli`, and footer CTAs resolve to the active Gumroad product
- [ ] 5.4 Verify a real **$0** guest checkout and a real **paid** guest checkout both complete and deliver the current archive, with no account required on our site

## 6. Verify

- [x] 6.1 `npm run build` succeeds; `/kit` prerenders as static; CTAs render the coming-soon state when the URL is unset and a plain outbound link when set
- [x] 6.2 `npm test` green, including the launcher-not-snapshot guard; the packaging script's manifest check covers exactly what ships
- [x] 6.3 Confirm no third-party script was added and the free path stays static (no new server route)
- [x] 6.4 Manually verify the outbound link target and that the kit archive builds reproducibly
