import { v } from 'convex/values';
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';

const LEASE_MS = 2 * 60_000;

const leaseOf = (ctx: MutationCtx, deployment: string) =>
	ctx.db
		.query('targets')
		.withIndex('by_deployment', (q) => q.eq('deployment', deployment))
		.unique();

// The leases webhooks go to. Claims only matter on these, since a lapsed lease drops its claims.
const liveTargets = (ctx: QueryCtx, now: number) =>
	ctx.db
		.query('targets')
		.withIndex('by_expiresAt', (q) => q.gt('expiresAt', now))
		.take(50);

/** Returns the paths the deployment has claimed */
export const lease = internalMutation({
	args: { deployment: v.string() },
	handler: async (ctx, { deployment }) => {
		const now = Date.now();
		// Deleted worktrees never release their lease, so sweep a few here.
		for (const expired of await ctx.db
			.query('targets')
			.withIndex('by_expiresAt', (q) => q.lte('expiresAt', now))
			.take(10)) {
			await ctx.db.delete('targets', expired._id);
		}
		const existing = await leaseOf(ctx, deployment);
		// A lapsed lease ends its claims, even when the sweep above missed it.
		const routes = existing && existing.expiresAt > now ? existing.routes : [];
		if (existing)
			await ctx.db.patch('targets', existing._id, { expiresAt: now + LEASE_MS, routes });
		else await ctx.db.insert('targets', { deployment, expiresAt: now + LEASE_MS, routes });
		return routes;
	}
});

/** Ends the lease and its claims */
export const release = internalMutation({
	args: { deployment: v.string() },
	handler: async (ctx, { deployment }) => {
		const existing = await leaseOf(ctx, deployment);
		if (existing) await ctx.db.delete('targets', existing._id);
		return [];
	}
});

/** Returns the paths the deployment has claimed, or null without a lease */
export const claim = internalMutation({
	args: { deployment: v.string(), path: v.string() },
	handler: async (ctx, { deployment, path }) => {
		const now = Date.now();
		const existing = await leaseOf(ctx, deployment);
		if (!existing || existing.expiresAt <= now) return null;
		// One deployment answers a path, so claiming it takes it from any other.
		for (const other of await liveTargets(ctx, now)) {
			if (other.deployment !== deployment && other.routes.includes(path)) {
				await ctx.db.patch('targets', other._id, {
					routes: other.routes.filter((route) => route !== path)
				});
			}
		}
		const routes = [...new Set([...existing.routes, path])];
		await ctx.db.patch('targets', existing._id, { routes });
		return routes;
	}
});

/** Returns the paths the deployment still claims, or null without a lease */
export const unclaim = internalMutation({
	args: { deployment: v.string(), path: v.string() },
	handler: async (ctx, { deployment, path }) => {
		const existing = await leaseOf(ctx, deployment);
		if (!existing || existing.expiresAt <= Date.now()) return null;
		const routes = existing.routes.filter((route) => route !== path);
		await ctx.db.patch('targets', existing._id, { routes });
		return routes;
	}
});

export const active = internalQuery({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		const targets = await liveTargets(ctx, now);
		return targets.map(({ deployment, routes }) => ({ deployment, routes }));
	}
});

/** Replays a webhook against each deployment's HTTP actions at the same path. */
export const forward = internalAction({
	args: {
		deployments: v.array(v.string()),
		pathAndQuery: v.string(),
		headers: v.record(v.string(), v.string()),
		body: v.bytes()
	},
	handler: async (_ctx, { deployments, pathAndQuery, headers, body }) => {
		await Promise.all(
			deployments.map(async (deployment) => {
				const url = `https://${deployment}.convex.site${pathAndQuery}`;
				try {
					const response = await fetch(url, {
						method: 'POST',
						headers,
						body,
						signal: AbortSignal.timeout(30_000)
					});
					console.log(`${response.status} ${url}`);
				} catch (error) {
					console.error(`Failed ${url}:`, error);
				}
			})
		);
		return null;
	}
});
