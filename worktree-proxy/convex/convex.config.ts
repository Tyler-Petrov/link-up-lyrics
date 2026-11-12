import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
	env: {
		// Shared with `pnpm dev` (each worktree's .env.local, pulled from the Convex project's default dev
		// environment variables), which leases this proxy for its worktree's deployment.
		WORKTREE_PROXY_SECRET: v.string()
	}
});

export default app;
