Hey Agent, my name's Tyler. I'm a Software Engineer that loves making complex problems simple by designing them with good underlying architecture from the start.

Be careful not to overcomplicate things. I enjoy simplicity, so push back when the implementation becomes complex. Don't just push ahead, instead wonder if there's a simpler way to do something. If the change is big compared to the request then run it by me. Make sure the primitives line up with what they're used for. Check the codebase for project level wrappers and primitives for what you're trying to do. If there are none, then tell me what you added after the implementation is done.

Don't add complexity for hypothetical edge cases. Handle cases supported by actual requirements or demonstrated failure modes.

Read similar implementations and the shared utilities they use before designing. Prefer derived values and inferred types over duplicate state and manually repeated types. Keep each piece of information defined in one authoritative place.

Tests and docs are really important to get right, so don't add or suggest them yourself. I'll add them where the project needs them.

Prefer triggering actions when data changes from a trigger rather than in every mutation.

## UI Design preferences

In general I like rounded corners and animations. Svelte animations and transitions are usually enough for that. Watch for UI jumps with flex/grid gaps appearing/disappearing all at once.

## Code changes and releases

Make code changes on a separate branch and integrate them through pull requests against `main`. Release only with `pnpm release`, which runs the Deploy production GitHub Actions workflow on `main`: it stages the Worker version, deploys Convex, runs `init`, then promotes the Worker. Never release by running `convex deploy` or `wrangler deploy` directly.

To preview a PR, add the `deploy-preview` label. Each push then gets a fresh Convex preview deployment loaded with `seed.zip` and a `pr-<number>` URL on the `link-up-lyrics-preview` Worker, commented on the PR.

If any data needs to be migrated, make sure it runs automatically after deploy. The `init` and `runNewMigrations` Convex functions are for this purpose. `pnpm dev` runs `init` each time it starts, and the release and preview workflows run it after deploying.

## Worktrees and the dev server

Work in a T3 Code worktree per task. Its setup (`. scripts/worktree-setup.sh`) installs dependencies and gives the branch its own Convex dev deployment, which expires after 14 days: it pushes the functions, imports `seed.zip`, runs `init`, and writes `.env.local`. Rerunning it resets the data to the seed. Secrets come from the Convex project's default dev environment variables (`pnpm exec convex env default list --type dev`), so change them there.

`pnpm dev` starts the worktree's dev server in the background (Convex plus Vite on a free port) and prints its local and Tailscale URLs. Its output is in `.dev-server.log`. `pnpm dev --help` lists the rest: `restart`, `stop`, `servers`, `sign-in`, `claim`.

`seed.zip` is the data every new deployment starts with. When the schema changes, the pre-commit hook blocks the commit until `pnpm seed:update` re-exports the seed from your worktree's deployment, so migrate that deployment's data first. Keep seed data synthetic: the repo is public.

Webhooks from the Clerk development instance go to the worktree proxy (`worktree-proxy/`, its own Convex project), which sends each one to every running dev server. `pnpm dev claim <path>` sends a path only to your worktree. Deploy the proxy with `pnpm --filter worktree-proxy deploy` after changing it.

## Signing in to test

Run `pnpm dev sign-in [userId] [path]` to print a five-minute sign-in link to the worktree's dev server. It signs in as the seed's user unless given a `User` document ID. It only works with Clerk's development instance (`src/convex/dev.ts`).

## Layout

- `src/convex`: Convex functions. Import `mutation`, `internalMutation`, `authQuery`, `authMutation` and `valibotMutation` from `functions.ts`, never from `_generated/server`, so triggers run. Business logic is in `model/`, and code shared with the frontend in `shared/` (like the chart module, `shared/chart`).
- `src/lib`: frontend code. `src/routes`: `(app)` has the header, `(app)/(account)` needs an account, and `live` is the page the QR code opens.
- SvelteKit 3 has no `$lib`, so imports use package.json subpaths with explicit extensions: `#lib/motion.js`, `#convex/shared/chart/index.js`.
- Env files: `.env.development` and `.env.production` hold the public values and are committed; `.env.local` is per worktree. In production, `CLERK_SECRET_KEY` is a Worker secret.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

<!-- convex-ai-end -->

## Svelte

For Svelte components and modules, use the `svelte-code-writer` and `svelte-core-bestpractices` skills. For big Svelte changes, run `svelte-autofixer` on the changed components.
