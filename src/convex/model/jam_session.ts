import { groupArrangement } from '#lib/chart/index.js';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { loadArrangement } from './song';

/** A setlist is a band's evening, not a library: well under this. */
export const MAX_ITEMS = 200;

/** The session's setlist in play order. */
export async function loadSetlist(ctx: QueryCtx, jamSessionId: Id<'JamSession'>) {
	return await ctx.db
		.query('JamSessionItem')
		.withIndex('by_jamSessionId_and_order', (q) => q.eq('jamSessionId', jamSessionId))
		.take(MAX_ITEMS);
}

/** How many line groups the item's song has (what Next/Prev walk through). A missing song counts as one. */
export async function groupCount(ctx: QueryCtx, item: Doc<'JamSessionItem'>) {
	const song = await ctx.db.get('Song', item.contentRef._id);
	if (!song) return 1;
	return Math.max(1, groupArrangement((await loadArrangement(ctx, song)).blocks).length);
}

/** The fields setFocus patches. A new epoch keys the live page's cross-fade. */
export function focusPatch(itemId: Id<'JamSessionItem'> | undefined, groupIndex: number) {
	return {
		focusedItemId: itemId,
		focusedGroupIndex: itemId ? Math.max(0, Math.floor(groupIndex)) : undefined,
		focusedEpoch: Date.now()
	};
}

/*
 * A CCLI report counts a song once per service, so a song used again within this window of its last use in
 * the same session is the same evening. A window rather than a calendar day: a Wednesday-night group in
 * California crosses UTC midnight mid-set, and we don't know the church's time zone.
 */
const SAME_SERVICE_MS = 12 * 60 * 60 * 1000;

/**
 * Records a SongUsage row when a live session focuses a song it hasn't shown this service. Called from the
 * JamSession trigger, so every way focus can change (tap, Next, going live) is covered once. §18.4.
 */
export async function recordSongUsage(
	ctx: MutationCtx,
	oldSession: Doc<'JamSession'> | null,
	session: Doc<'JamSession'>
) {
	if (!session.isLive || !session.focusedItemId) return;
	if (oldSession?.isLive && oldSession.focusedItemId === session.focusedItemId) return;

	const item = await ctx.db.get('JamSessionItem', session.focusedItemId);
	const song = item && (await ctx.db.get('Song', item.contentRef._id));
	if (!song) return;

	const now = Date.now();
	const recent = await ctx.db
		.query('SongUsage')
		.withIndex('by_jamSessionId_and_usedEpoch', (q) =>
			q.eq('jamSessionId', session._id).gte('usedEpoch', now - SAME_SERVICE_MS)
		)
		.take(MAX_ITEMS);
	if (recent.some((usage) => usage.songId === song._id)) return;

	await ctx.db.insert('SongUsage', {
		ownerId: session.ownerId,
		jamSessionId: session._id,
		songId: song._id,
		title: song.title,
		ccliSongNumber: song.ccliSongNumber,
		usedEpoch: now
	});
}
