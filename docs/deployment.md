# Deployment

The free product is a static Next.js site with a few serverless API routes that stay **inert until
their env vars are set**. It deploys to Vercel's free tier with **zero required configuration**.

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
  static / SSG, served from the CDN.
- **API routes** (`/api/me`, `/api/auth/*`, `/api/checkout`, `/api/stripe/webhook`,
  `/api/prompts/*`, `/api/billing/portal`) — serverless functions. With no env set they degrade
  cleanly: `/api/me` reports the free plan without invoking auth, and the account/upgrade UI hides
  itself. Nothing charges or stores anything.

## Go-live checks

- Home renders; paste a prompt and confirm a real audit (findings + dollar figures).
- A model page (e.g. `/models/claude-opus-5`) and a waste page render with content.
- `/sitemap.xml` and `/robots.txt` resolve; the sitemap lists the content routes.
- A shared report (`/r#…`) decodes into the receipt.
- No account/"Sign in" control appears (auth is not configured).

## Later — activating Pro (optional, currently deferred)

Pro is shelved (see `docs/decisions.md`). To activate it, set the Stripe, Auth, and Database env
groups from `apps/web/.env.example`, create a Stripe product/price, and apply the schema (`db:push`).
See `docs/monetization.md` for the full checklist.

## Related: publishing the CLI

The web app and the CLI ship independently. Publishing `npx savedyouatoken` (which the agent kit and
skill depend on) is a separate one-time step — see `packages/cli/RELEASING.md`.
