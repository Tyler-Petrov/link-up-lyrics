/*
 * Jam sessions and their setlists: the leader's console. Focus = (setlist item, group index); the live page
 * (live.ts) follows it. Owners rename and delete; leaders and up run the setlist and the focus. §14, §17.
 */
import { ConvexError, v } from 'convex/values';
import { atTagOrHigher } from './constants';
import { authMutation, authQuery, valibotMutation } from './functions';
import { createJamSessionSchema, renameJamSessionSchema } from './forms/jam_session';
import { jamSessionRole, requireJamSessionRole, requireSongOwner } from './model/access';
import { requireCanHost } from './model/billing';
import { focusPatch, groupCount, loadSetlist, MAX_ITEMS } from './model/jam_session';
import { presence } from './components';
import { fitsBetween, orderBetween } from '#convex/shared/chart/index.js';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

/** Sessions you own, then the ones you play in, each with your role. */
export const listMine = authQuery({
	args: {},
	handler: async (ctx) => {
		const owned = await ctx.db
			.query('JamSession')
			.withIndex('by_ownerId', (q) => q.eq('ownerId', ctx.user._id))
			.order('desc')
			.take(200);
		const memberships = await ctx.db
			.query('JamSessionMember')
			.withIndex('by_userId_and_statusTag', (q) =>
				q.eq('userId', ctx.user._id).eq('statusTag', 'accepted')
			)
			.take(200);
		const joined = [];
		for (const membership of memberships) {
			const session = await ctx.db.get('JamSession', membership.jamSessionId);
			if (session) joined.push({ ...session, roleTag: membership.roleTag });
		}
		return [...owned.map((session) => ({ ...session, roleTag: 'owner' as const })), ...joined];
	}
});

/**
 * The session and the caller's role when they lead it, else null: it was deleted, or they're not (or no longer)
 * a leader. The console's queries return null then, so a console left open shows "Session not found".
 */
async function ledSession(ctx: QueryCtx & { user: Doc<'User'> }, jamSessionId: string) {
	const id = ctx.db.normalizeId('JamSession', jamSessionId);
	const session = id && (await ctx.db.get('JamSession', id));
	if (!session) return null;
	const roleTag = await jamSessionRole(ctx, session, ctx.user);
	return atTagOrHigher('JamSessionRoles', roleTag, 'leader')
		? { session, roleTag: roleTag! }
		: null;
}

/**
 * The console's session and setlist, or null (see ledSession). Takes the id as a string because it comes
 * straight from the URL.
 */
export const get = authQuery({
	args: { jamSessionId: v.string() },
	handler: async (ctx, args) => {
		const led = await ledSession(ctx, args.jamSessionId);
		if (!led) return null;

		const items = [];
		for (const item of await loadSetlist(ctx, led.session._id)) {
			const song = await ctx.db.get('Song', item.contentRef._id);
			if (song) items.push({ ...item, song });
		}
		return { ...led, items };
	}
});

/**
 * "27 watching · 4 in the band": who has the live page open right now (waiting or watching), and who's in the
 * band at all. The band is the owner (never a member row) plus accepted members, so a solo leader sees 1. Null
 * like `get`. §15.
 */
export const connectedCount = authQuery({
	args: { jamSessionId: v.id('JamSession') },
	handler: async (ctx, { jamSessionId }) => {
		if (!(await ledSession(ctx, jamSessionId))) return null;
		const online = await presence.listRoom(ctx, jamSessionId, true, 1000);
		const members = await ctx.db
			.query('JamSessionMember')
			.withIndex('by_jamSessionId_and_statusTag', (q) =>
				q.eq('jamSessionId', jamSessionId).eq('statusTag', 'accepted')
			)
			.take(1000);
		return { watching: online.length, band: 1 + members.length };
	}
});

export const create = valibotMutation({
	schema: createJamSessionSchema,
	handler: async (ctx, data) => {
		await requireCanHost(ctx, ctx.user);
		return await ctx.db.insert('JamSession', {
			name: data.name,
			ownerId: ctx.user._id,
			isLive: false
		});
	}
});

export const rename = valibotMutation({
	schema: renameJamSessionSchema,
	handler: async (ctx, data) => {
		const jamSessionId = ctx.db.normalizeId('JamSession', data.jamSessionId);
		if (!jamSessionId) throw new ConvexError('NOT_FOUND');
		await requireJamSessionRole(ctx, jamSessionId, 'owner');
		await ctx.db.patch('JamSession', jamSessionId, { name: data.name });
		return jamSessionId;
	}
});

/** Deletes the session; a trigger removes its setlist and members. */
export const remove = authMutation({
	args: { jamSessionId: v.id('JamSession') },
	handler: async (ctx, { jamSessionId }) => {
		await requireJamSessionRole(ctx, jamSessionId, 'owner');
		await ctx.db.delete('JamSession', jamSessionId);
		return null;
	}
});

/** Appends a song from the caller's own library. */
export const addSong = authMutation({
	args: { jamSessionId: v.id('JamSession'), songId: v.id('Song') },
	handler: async (ctx, { jamSessionId, songId }) => {
		await requireJamSessionRole(ctx, jamSessionId, 'leader');
		await requireSongOwner(ctx, songId, ctx.user);
		const items = await loadSetlist(ctx, jamSessionId);
		if (items.length >= MAX_ITEMS)
			throw new ConvexError(`A setlist holds up to ${MAX_ITEMS} songs`);
		const last = items.at(-1);
		return await ctx.db.insert('JamSessionItem', {
			jamSessionId,
			contentRef: { type: 'Song', _id: songId },
			order: orderBetween(last?.order, undefined),
			transposeSemitones: 0
		});
	}
});

/** The item and the caller's right to change its session. */
async function requireItem(ctx: MutationCtx, itemId: Id<'JamSessionItem'>) {
	const item = await ctx.db.get('JamSessionItem', itemId);
	if (!item) throw new ConvexError('NOT_FOUND');
	await requireJamSessionRole(ctx, item.jamSessionId, 'leader');
	return item;
}

/** Removes a setlist item. A trigger clears the focus when it was focused. */
export const removeItem = authMutation({
	args: { itemId: v.id('JamSessionItem') },
	handler: async (ctx, { itemId }) => {
		await requireItem(ctx, itemId);
		await ctx.db.delete('JamSessionItem', itemId);
		return null;
	}
});

/**
 * Moves an item between its new neighbours (either may be missing at the ends). One row written, unless the
 * gap has run out of precision and the setlist is renumbered first.
 */
export const moveItem = authMutation({
	args: {
		itemId: v.id('JamSessionItem'),
		previousId: v.optional(v.id('JamSessionItem')),
		nextId: v.optional(v.id('JamSessionItem'))
	},
	handler: async (ctx, { itemId, previousId, nextId }) => {
		const item = await requireItem(ctx, itemId);
		const neighbour = async (id: Id<'JamSessionItem'> | undefined) => {
			if (!id) return undefined;
			const doc = await ctx.db.get('JamSessionItem', id);
			if (doc?.jamSessionId !== item.jamSessionId) throw new ConvexError('NOT_FOUND');
			return doc;
		};
		let [previous, next] = [await neighbour(previousId), await neighbour(nextId)];
		if (previous && next && previous.order >= next.order) throw new ConvexError('INVALID_MOVE');
		let order = orderBetween(previous?.order, next?.order);
		if (!fitsBetween(previous?.order, next?.order, [order])) {
			for (const [index, row] of (await loadSetlist(ctx, item.jamSessionId)).entries())
				await ctx.db.patch('JamSessionItem', row._id, { order: index });
			[previous, next] = [await neighbour(previousId), await neighbour(nextId)];
			order = orderBetween(previous?.order, next?.order);
		}
		await ctx.db.patch('JamSessionItem', itemId, { order });
		return null;
	}
});

export const setTranspose = authMutation({
	args: { itemId: v.id('JamSessionItem'), semitones: v.number() },
	handler: async (ctx, { itemId, semitones }) => {
		await requireItem(ctx, itemId);
		if (!Number.isInteger(semitones) || Math.abs(semitones) > 11)
			throw new ConvexError('INVALID_TRANSPOSE');
		await ctx.db.patch('JamSessionItem', itemId, { transposeSemitones: semitones });
		return null;
	}
});

/** Go live (gated on the owner's plan) or end. Going live with nothing focused focuses the first song. */
export const setLive = authMutation({
	args: { jamSessionId: v.id('JamSession'), isLive: v.boolean() },
	handler: async (ctx, { jamSessionId, isLive }) => {
		const { session } = await requireJamSessionRole(ctx, jamSessionId, 'leader');
		if (!isLive) {
			await ctx.db.patch('JamSession', jamSessionId, { isLive });
			return null;
		}
		const owner = await ctx.db.get('User', session.ownerId);
		if (!owner) throw new ConvexError('NOT_FOUND');
		await requireCanHost(ctx, owner);
		const first = session.focusedItemId ? undefined : (await loadSetlist(ctx, jamSessionId))[0];
		await ctx.db.patch('JamSession', jamSessionId, {
			isLive,
			...(first ? focusPatch(first._id, 0) : {})
		});
		return null;
	}
});

/** Focus a setlist item's group: a tap on a song or a group in the console. */
export const setFocus = authMutation({
	args: {
		jamSessionId: v.id('JamSession'),
		itemId: v.id('JamSessionItem'),
		groupIndex: v.number()
	},
	handler: async (ctx, { jamSessionId, itemId, groupIndex }) => {
		await requireJamSessionRole(ctx, jamSessionId, 'leader');
		const item = await ctx.db.get('JamSessionItem', itemId);
		if (item?.jamSessionId !== jamSessionId) throw new ConvexError('NOT_FOUND');
		const lastGroup = (await groupCount(ctx, item)) - 1;
		await ctx.db.patch(
			'JamSession',
			jamSessionId,
			focusPatch(itemId, Math.min(groupIndex, lastGroup))
		);
		return null;
	}
});

/**
 * Next / Prev group. Past the last group goes to the next song's first; before the first goes to the
 * previous song's last. At either end of the setlist it stays put.
 */
export const step = authMutation({
	args: { jamSessionId: v.id('JamSession'), direction: v.union(v.literal(1), v.literal(-1)) },
	handler: async (ctx, { jamSessionId, direction }) => {
		const { session } = await requireJamSessionRole(ctx, jamSessionId, 'leader');
		const items = await loadSetlist(ctx, jamSessionId);
		const index = items.findIndex((item) => item._id === session.focusedItemId);
		const item = items[index];
		if (!item) {
			if (items[0]) await ctx.db.patch('JamSession', jamSessionId, focusPatch(items[0]._id, 0));
			return null;
		}
		// The song may have lost groups since it was focused.
		const count = await groupCount(ctx, item);
		const groupIndex = Math.min(session.focusedGroupIndex ?? 0, count - 1);
		let target: [Id<'JamSessionItem'>, number] | undefined;
		if (direction === 1) {
			if (groupIndex + 1 < count) target = [item._id, groupIndex + 1];
			else if (items[index + 1]) target = [items[index + 1]!._id, 0];
		} else {
			if (groupIndex > 0) target = [item._id, groupIndex - 1];
			else if (items[index - 1])
				target = [items[index - 1]!._id, (await groupCount(ctx, items[index - 1]!)) - 1];
		}
		if (target) await ctx.db.patch('JamSession', jamSessionId, focusPatch(...target));
		return null;
	}
});
