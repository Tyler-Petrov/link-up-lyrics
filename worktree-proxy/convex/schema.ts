import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	// Link Up Lyrics dev deployments receiving webhooks. `pnpm dev` keeps renewing the lease while it runs, so a
	// stopped or crashed dev server drops out.
	targets: defineTable({
		deployment: v.string(),
		expiresAt: v.number(),
		// Paths only this deployment answers, claimed while its lease lasts.
		routes: v.array(v.string())
	})
		.index('by_deployment', ['deployment'])
		.index('by_expiresAt', ['expiresAt'])
});
