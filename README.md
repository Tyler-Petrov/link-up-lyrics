# Link Up Lyrics

Shared chord charts for small groups. A song is lines of characters, each optionally carrying a chord; a jam
session is a setlist plus the band, and one QR code shows whatever the leader is on: chords for the players,
lyrics for everyone else.

SvelteKit 3 (async Svelte 5) on Cloudflare Workers, Convex, Clerk, Tailwind v4 + shadcn-svelte.

## Setup

```sh
pnpm install
cp .env.example .env.local   # add the Clerk development keys
pnpm dev                     # Convex dev deployment + Vite on http://localhost:5173
```

The first `pnpm dev` asks which Convex project to use and writes `CONVEX_DEPLOYMENT`, `PUBLIC_CONVEX_URL`
and `PUBLIC_CONVEX_SITE_URL` to `.env.local`. The dev deployment needs one environment variable:

```sh
pnpm exec convex env set CLERK_FRONTEND_API_URL https://<your-instance>.clerk.accounts.dev
```

Clerk needs a JWT template named `convex` (Clerk Dashboard → Configure → JWT templates → New → Convex).

Development data, three public-domain hymns per user:

```sh
pnpm exec convex run seed:hymns                                  # every user
pnpm exec convex run seed:hymns '{"email":"you@example.com"}'    # one user
```

Sign in without a browser round trip (dev instance only):

```sh
pnpm sign-in [email] [path]   # prints a five-minute link to http://localhost:5173
```

Worktrees: `scripts/worktree-setup.sh` installs dependencies and copies `.env.local` from the main checkout.

Checks: `pnpm check` (svelte-check + the Convex functions' tsc) and `pnpm build`.

## Layout

- `src/convex` — Convex functions (`#convex/*`). Import `mutation`/`internalMutation`/`authQuery`/
  `authMutation`/`valibotMutation` from `functions.ts`, never from `_generated/server`.
- `src/lib` — app code (`#lib/*`). `src/lib/chart` is the pure chart module shared by the browser and Convex.
- `src/routes` — `(app)` has the header; `(app)/(account)` needs an account; `live` is the bare QR page.

SvelteKit 3 removed `$lib`, so both trees use package.json subpath imports with explicit extensions
(`#lib/chart/index.js`, `#convex/constants.js`). Convex's bundler resolves them too.

## Releasing

Releases go through `pnpm release`, which dispatches `.github/workflows/deploy-production.yml` on `main`
and watches it: build and stage a Worker version on Cloudflare, `convex deploy`, `convex run init --prod`
(automatic data migrations), then promote the staged version. Never run `convex deploy` or `wrangler deploy`
by hand.

### One-time production setup

1. **Clerk production instance** for the app's domain, with a `convex` JWT template.
2. **Convex production deployment** (project `link-up-lyrics-fd369`): set
   `CLERK_FRONTEND_API_URL` to the production instance's Frontend API URL
   (`pnpm exec convex env set --prod CLERK_FRONTEND_API_URL https://clerk.<domain>`).
3. **`.env.production`**: replace the placeholders with the production `PUBLIC_CONVEX_URL`,
   `PUBLIC_CONVEX_SITE_URL` and `PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`). They're public and committed.
4. **Cloudflare Worker secret**: `pnpm exec wrangler secret put CLERK_SECRET_KEY` (the `sk_live_…` key).
5. **GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `CONVEX_DEPLOY_KEY` — a production deploy key from the Convex dashboard.
   - `CLOUDFLARE_API_TOKEN` — a token with Workers Scripts: Edit on account `f8bdca2bb163fea5cdabf6348bef9049`.
