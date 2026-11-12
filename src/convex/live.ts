/*
 * The live page's backend: the one query it needs, and the presence heartbeat that makes the console's
 * "N watching". No account needed for either. §14.4, §15.
 */
import { ConvexError, v } from 'convex/values';
import { stripChords } from '#convex/shared/chart/index.js';
import { query } from './_generated/server';
import { mutation } from './functions';
import { presence, rateLimiter } from './components';
import { jamSessionRole } from './model/access';
import { loadArrangement } from './model/song';
import { currentUser } from './model/user';
import schema from './schema';
import { convexTagValidator } from './validators';

const block = v.union(
	v.object({
		type: v.literal('section'),
		key: v.string(),
		section: schema.doc('SongSection'),
		source: schema.doc('SongSection'),
		isRepeat: v.boolean(),
		lines: v.array(schema.doc('SongLine'))
	}),
	v.object({ type: v.literal('loose'), key: v.string(), lines: v.array(schema.doc('SongLine')) })
);

/**
 * What the room sees. Anonymous viewers all send the same args with no identity, so they share one
 * subscription. Band members (any accepted role, or the owner) get chords, transposed by the setlist item;
 * everyone else gets lines with the chord key absent entirely. The client derives line groups from `blocks`
 * with groupArrangement, like the console does.
 */
export const watch = query({
	args: { jamSessionId: v.string() },
	returns: v.union(
		v.object({ state: v.literal('notFound') }),
		v.object({ state: v.literal('offline'), name: v.string() }),
		v.object({ state: v.literal('waiting'), name: v.string() }),
		v.object({
			state: v.literal('live'),
			name: v.string(),
			focusedItemId: v.id('JamSessionItem'),
			focusedGroupIndex: v.number(),
			focusedEpoch: v.number(),
			isPlayer: v.boolean(),
			song: v.object({
				title: v.string(),
				artist: v.optional(v.string()),
				originalKeyTag: v.optional(convexTagValidator('MusicalKeys')),
				copyrightLine: v.optional(v.string()),
				ccliSongNumber: v.optional(v.string())
			}),
			/* The church's license, shown with the song's credits. §18.7. */
			ccliLicenseNumber: v.optional(v.string()),
			blocks: v.array(block),
			transposeSemitones: v.number()
		})
	),
	handler: async (ctx, args) => {
		const jamSessionId = ctx.db.normalizeId('JamSession', args.jamSessionId);
		const session = jamSessionId && (await ctx.db.get('JamSession', jamSessionId));
		if (!session) return { state: 'notFound' as const };
		if (!session.isLive) return { state: 'offline' as const, name: session.name };

		const item =
			session.focusedItemId && (await ctx.db.get('JamSessionItem', session.focusedItemId));
		const song = item && (await ctx.db.get('Song', item.contentRef._id));
		if (!item || !song) return { state: 'waiting' as const, name: session.name };

		const isPlayer = (await jamSessionRole(ctx, session, await currentUser(ctx))) !== undefined;
		const { blocks } = await loadArrangement(ctx, song);
		const owner = await ctx.db.get('User', session.ownerId);

		return {
			state: 'live' as const,
			name: session.name,
			focusedItemId: item._id,
			focusedGroupIndex: session.focusedGroupIndex ?? 0,
			focusedEpoch: session.focusedEpoch ?? 0,
			isPlayer,
			song: {
				title: song.title,
				artist: song.artist,
				originalKeyTag: song.originalKeyTag,
				copyrightLine: song.copyrightLine,
				ccliSongNumber: song.ccliSongNumber
			},
			ccliLicenseNumber: owner?.ccliLicenseNumber,
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
		};
	}
});

/**
 * Keeps this tab counted while it has the live page open, live or still waiting, so the console counts the room
 * before the leader goes live. `sessionId` is per tab; signed-in people count once however many tabs they have
 * open. Rate-limited per tab and per room, since the URL is public by design and the tab id is the client's to
 * choose.
 */
export const heartbeat = mutation({
	args: { jamSessionId: v.id('JamSession'), sessionId: v.string(), interval: v.number() },
	handler: async (ctx, { jamSessionId, sessionId, interval }) => {
		const session = await ctx.db.get('JamSession', jamSessionId);
		if (!session) throw new ConvexError('NOT_FOUND');
		await rateLimiter.limit(ctx, 'liveHeartbeat', { key: sessionId, throws: true });
		await rateLimiter.limit(ctx, 'liveRoomHeartbeat', { key: jamSessionId, throws: true });
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
