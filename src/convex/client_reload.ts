import { v } from 'convex/values';
import { query } from './_generated/server';
import { internalMutation } from './functions';

/** Records that a new frontend is live, so open pages check for it instead of waiting for their next poll.
 *  The deploy workflow runs it after promoting the release. */
export const released = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await ctx.db.insert('FrontendRelease', {});
		return null;
	}
});

/** When the newest frontend went live */
export const latestRelease = query({
	args: {},
	returns: v.union(v.number(), v.null()),
	handler: async (ctx) => {
		const release = await ctx.db.query('FrontendRelease').order('desc').first();
		return release?._creationTime ?? null;
	}
});
