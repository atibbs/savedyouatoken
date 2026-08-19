# Deployment

The free product is a fully static Next.js site. It deploys to Vercel's free tier with **zero
required configuration** and has no serverless API routes at all — the account/billing routes that
used to exist here (inert, env-gated) moved to the private `savedyouatoken-cloud` repository as part
of publishing this repository's source; see `docs/community-boundary.md`.

## One-time setup (Vercel)

1. **Import the repo** `atibbs/savedyouatoken` into Vercel (New Project → Import Git Repository).
2. **Root Directory:** set to `apps/web`. It is an npm-workspaces monorepo; Vercel installs from the
   repo root and builds the web app. Framework is auto-detected as **Next.js** — leave Build and
   Install commands on their defaults.
3. **Environment variables:** none are required. Optionally set `NEXT_PUBLIC_SITE_URL` to
   `https://savedyouatoken.com` (it already defaults to that, and drives canonical URLs, the sitemap,
   and share links).
4. **Deploy.** Every push to `main` redeploys; pull requests get preview deployments.

## Custom domain

In the Vercel project → **Domains**, add `savedyouatoken.com` (and `www`), then point DNS at Vercel
per the records it shows (an `A`/`ALIAS` for the apex, a `CNAME` for `www`). Set the apex as primary.
Once the domain is live, confirm `NEXT_PUBLIC_SITE_URL` matches it.

## What deploys

- **Content + SEO pages** (`/`, `/waste/*`, `/models/*`, `/pricing`, `/cli`, `/methodology`, `/r`) —
  static / SSG, served from the CDN. Nothing charges or stores anything.

## Go-live checks

- Home renders; paste a prompt and confirm a real audit (findings + dollar figures).
- A model page (e.g. `/models/claude-opus-5`) and a waste page render with content.
- `/sitemap.xml` and `/robots.txt` resolve; the sitemap lists the content routes.
- A shared report (`/r#…`) decodes into the receipt.
- No account/"Sign in" control appears (there is none — the site has no accounts).

## Later — activating Pro (optional, currently deferred)

Pro is shelved (see `docs/decisions.md`). Its account/database/billing implementation lives in the
private `savedyouatoken-cloud` repository, not here — activating it is a `savedyouatoken-cloud`
deployment, separate from this static site, not an env var set on this one. See
`docs/monetization.md` for the full checklist.

## Related: publishing the CLI

The web app and the CLI ship independently. Publishing `npx savedyouatoken` (which the agent kit and
skill depend on) is a separate one-time step — see `packages/cli/RELEASING.md`.
