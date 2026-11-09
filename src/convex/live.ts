/*
 * The live page's backend: the one query it needs, and the presence heartbeat that makes the console's
 * "N watching". No account needed for either. §14.4, §15.
 */
import { ConvexError, v } from 'convex/values';
import { stripChords } from '#lib/chart/index.js';
import { query } from './_generated/server';
import { mutation } from './functions';
import { presence, rateLimiter } from './components';
import { jamSessionRole } from './model/access';
import { loadArrangement } from './model/song';
import { currentUser } from './model/user';

/**
 * What the room sees. Anonymous viewers all send the same args with no identity, so they share one
 * subscription. Band members (any accepted role, or the owner) get chords, transposed by the setlist item;
 * everyone else gets lines with the chord key absent entirely. The client derives line groups from `blocks`
 * with groupArrangement, like the console does.
 */
export const watch = query({
	args: { jamSessionId: v.string() },
	handler: async (ctx, args) => {
		const jamSessionId = ctx.db.normalizeId('JamSession', args.jamSessionId);
		const session = jamSessionId && (await ctx.db.get('JamSession', jamSessionId));
		if (!session) return { state: 'notFound' } as const;
		if (!session.isLive) return { state: 'offline', name: session.name } as const;

		const item =
			session.focusedItemId && (await ctx.db.get('JamSessionItem', session.focusedItemId));
		const song = item && (await ctx.db.get('Song', item.contentRef._id));
		if (!item || !song) return { state: 'waiting', name: session.name } as const;

		const isPlayer = (await jamSessionRole(ctx, session, await currentUser(ctx))) !== undefined;
		const { blocks } = await loadArrangement(ctx, song);

		return {
			state: 'live',
			name: session.name,
			focusedItemId: item._id,
			focusedGroupIndex: session.focusedGroupIndex ?? 0,
			focusedEpoch: session.focusedEpoch ?? 0,
			isPlayer,
			song: {
				title: song.title,
				artist: song.artist,
				originalKeyTag: song.originalKeyTag
			},
			blocks: isPlayer
				? blocks
				: blocks.map((block) => ({
						...block,
						lines: block.lines.map((line) => ({
							...line,
							characters: stripChords(line.characters)
						}))
					})),
			transposeSemitones: isPlayer ? item.transposeSemitones : 0
		} as const;
	}
});

/**
 * Keeps this tab counted as watching. `sessionId` is per tab; signed-in people count once however many tabs
 * they have open. Rate-limited per tab, since the URL is public by design.
 */
export const heartbeat = mutation({
	args: { jamSessionId: v.id('JamSession'), sessionId: v.string(), interval: v.number() },
	handler: async (ctx, { jamSessionId, sessionId, interval }) => {
		await rateLimiter.limit(ctx, 'liveHeartbeat', { key: sessionId, throws: true });
		if (!(await ctx.db.get('JamSession', jamSessionId))) throw new ConvexError('NOT_FOUND');
		const user = await currentUser(ctx);
		return await presence.heartbeat(
			ctx,
			jamSessionId,
			user?._id ?? `anonymous:${sessionId}`,
			sessionId,
			Math.min(Math.max(interval, 5_000), 60_000)
		);
	}
});

/** Leaves the room now instead of on the heartbeat timeout. Unauthenticated: the token is the capability. */
export const disconnect = mutation({
	args: { sessionToken: v.string() },
	handler: async (ctx, { sessionToken }) => {
		await presence.disconnect(ctx, sessionToken);
		return null;
	}
});
