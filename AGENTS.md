Hey Agent, my name's Tyler. I'm a Software Engineer that loves making complex problems simple by designing them with good underlying architecture from the start.

Be careful not to overcomplicate things. I enjoy simplicity, so push back when the implementation becomes complex. Don't just push ahead, instead wonder if there's a simpler way to do something. If the change is big compared to the request then run it by me. Make sure the primitives line up with what they're used for. Check the codebase for project level wrappers and primitives for what you're trying to do. If there are none, then tell me what you added after the implementation is done.

Don't add complexity for hypothetical edge cases. Handle cases supported by actual requirements or demonstrated failure modes.

Read similar implementations and the shared utilities they use before designing. Prefer derived values and inferred types over duplicate state and manually repeated types. Keep each piece of information defined in one authoritative place.

Tests and docs are really important to get right, so don't add or suggest them yourself. I'll add them where the project needs them.

Prefer triggering actions when data changes from a trigger rather than in every mutation.

## UI Design preferences

In general I like rounded corners and animations. Svelte animations and transitions are usually enough for that. Watch for UI jumps with flex/grid gaps appearing/disappearing all at once.

## Code changes and releases

Make code changes on a separate branch and integrate them through pull requests against `main`. Release only with `pnpm release`, which runs the Deploy production GitHub Actions workflow on `main`. Never release by running `convex deploy` or `wrangler deploy` directly.

If any data needs to be migrated, make sure it runs automatically after deploy. The `init` and `runNewMigrations` Convex functions are for this purpose.

## Signing in to test

Run `pnpm sign-in [email] [path]` to print a five-minute sign-in link for the dev server. It reads `CLERK_SECRET_KEY` from `.env.local` and only works with Clerk's development instance.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

<!-- convex-ai-end -->

## Svelte

For Svelte components and modules, use the `svelte-code-writer` and `svelte-core-bestpractices` skills. For big Svelte changes, run `svelte-autofixer` on the changed components.
