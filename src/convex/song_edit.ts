/*
 * The song editor's writes (plan M3). Owner-only. A song's sections and its loose lines share one
 * fractional order space, and a section's lines have their own (§4.2), so inserting or moving anything writes
 * only the rows that moved. The song's "last edited" time is bumped by the triggers in functions.ts.
 */
import { ConvexError, v, type Infer } from 'convex/values';
import { fitsBetween, ordersBetween } from '#lib/chart/index.js';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { authMutation } from './functions';
import { requireSongOwner } from './model/access';
import { characterValidator, convexTagValidator, discriminatedUnionItem } from './validators';

type ParentRef = Doc<'SongLine'>['parentRef'];
const parentRefValidator = v.union(
	discriminatedUnionItem('Song'),
	discriminatedUnionItem('SongSection')
);
const charactersValidator = v.array(characterValidator);
/** A long hymn is well under this; it bounds what one paste or one block can write. */
const MAX_ROWS = 500;

async function requireLine(ctx: QueryCtx, user: Doc<'User'>, lineId: Id<'SongLine'>) {
	const line = await ctx.db.get('SongLine', lineId);
	if (!line) throw new ConvexError('NOT_FOUND');
	await requireSongOwner(ctx, line.songId, user);
	return line;
}

async function requireSection(ctx: QueryCtx, user: Doc<'User'>, sectionId: Id<'SongSection'>) {
	const section = await ctx.db.get('SongSection', sectionId);
	if (!section) throw new ConvexError('NOT_FOUND');
	await requireSongOwner(ctx, section.songId, user);
	return section;
}

/** The song a new line would belong to. A repeat has no lines of its own: edit its source instead. */
async function requireParent(ctx: QueryCtx, user: Doc<'User'>, parentRef: ParentRef) {
	if (parentRef.type === 'Song') return await requireSongOwner(ctx, parentRef._id, user);
	const section = await requireSection(ctx, user, parentRef._id);
	if (section.repeatOfId) throw new ConvexError('REPEAT_HAS_NO_LINES');
	return await requireSongOwner(ctx, section.songId, user);
}

/**
 * The orders bracketing a free slot next to `order` in the parent's space (for a song: its loose lines and
 * its sections): the neighbour after it, or before it with `side: 'before'`. With no `order`, the slot after
 * everything.
 */
async function slotNextTo(
	ctx: QueryCtx,
	parentRef: ParentRef,
	order: number | undefined,
	side: 'before' | 'after' = 'after'
) {
	const lines = ctx.db
		.query('SongLine')
		.withIndex('by_parentRef_and_order', (q) =>
			order === undefined
				? q.eq('parentRef', parentRef)
				: side === 'after'
					? q.eq('parentRef', parentRef).gt('order', order)
					: q.eq('parentRef', parentRef).lt('order', order)
		);
	const sections =
		parentRef.type === 'Song'
			? ctx.db
					.query('SongSection')
					.withIndex('by_songId_and_order', (q) =>
						order === undefined
							? q.eq('songId', parentRef._id)
							: side === 'after'
								? q.eq('songId', parentRef._id).gt('order', order)
								: q.eq('songId', parentRef._id).lt('order', order)
					)
			: undefined;
	const toward = order === undefined || side === 'before' ? 'desc' : 'asc';
	const nearest = [
		(await lines.order(toward).first())?.order,
		(await sections?.order(toward).first())?.order
	].filter((o) => o !== undefined);
	const neighbour = nearest.length
		? toward === 'desc'
			? Math.max(...nearest)
			: Math.min(...nearest)
		: undefined;
	if (order === undefined) return { before: neighbour, after: undefined };
	return side === 'after'
		? { before: order, after: neighbour }
		: { before: neighbour, after: order };
}

/**
 * Orders for `count` new rows in the slot next to `order` (see slotNextTo). When the gap has run out of
 * precision, the parent's rows are renumbered first.
 */
async function ordersNextTo(
	ctx: MutationCtx,
	parentRef: ParentRef,
	order: number | undefined,
	side: 'before' | 'after' = 'after',
	count = 1
) {
	const slot = await slotNextTo(ctx, parentRef, order, side);
	const orders = ordersBetween(slot.before, slot.after, count);
	if (fitsBetween(slot.before, slot.after, orders)) return orders;
	const renumbered = await renumber(ctx, parentRef);
	const moved = order === undefined ? undefined : (renumbered.get(order) ?? order);
	const retry = await slotNextTo(ctx, parentRef, moved, side);
	return ordersBetween(retry.before, retry.after, count);
}

/** Rewrites the parent's orders to 0, 1, 2… in their current sequence. Returns old order → new. */
async function renumber(ctx: MutationCtx, parentRef: ParentRef) {
	const lines = await ctx.db
		.query('SongLine')
		.withIndex('by_parentRef_and_order', (q) => q.eq('parentRef', parentRef))
		.take(MAX_ROWS);
	const sections =
		parentRef.type === 'Song'
			? await ctx.db
					.query('SongSection')
					.withIndex('by_songId_and_order', (q) => q.eq('songId', parentRef._id))
					.take(MAX_ROWS)
			: [];
	const rows = [
		...lines.map((line) => ({ table: 'SongLine' as const, id: line._id, order: line.order })),
		...sections.map((s) => ({ table: 'SongSection' as const, id: s._id, order: s.order }))
	].sort((a, b) => a.order - b.order);
	const renumbered = new Map<number, number>();
	for (const [index, row] of rows.entries()) {
		renumbered.set(row.order, index);
		if (row.table === 'SongLine') await ctx.db.patch('SongLine', row.id, { order: index });
		else await ctx.db.patch('SongSection', row.id, { order: index });
	}
	return renumbered;
}

/** Sets a line's characters: its words and the chords on them (typing, the chord picker, bracket edits). */
export const setCharacters = authMutation({
	args: { lineId: v.id('SongLine'), characters: charactersValidator },
	handler: async (ctx, { lineId, characters }) => {
		await requireLine(ctx, ctx.user, lineId);
		await ctx.db.patch('SongLine', lineId, { characters });
		return null;
	}
});

/**
 * Replaces a line with `lines`: the first is written to it, the rest are inserted after it (Enter splits a
 * line in two; a multi-line paste makes many). Returns the new lines' ids.
 */
export const replaceLine = authMutation({
	args: { lineId: v.id('SongLine'), lines: v.array(charactersValidator) },
	handler: async (ctx, { lineId, lines }) => {
		const line = await requireLine(ctx, ctx.user, lineId);
		const [first, ...rest] = lines;
		if (!first || rest.length > MAX_ROWS) throw new ConvexError('INVALID_LINES');
		await ctx.db.patch('SongLine', lineId, { characters: first });
		const orders = await ordersNextTo(ctx, line.parentRef, line.order, 'after', rest.length);
		const ids: Id<'SongLine'>[] = [];
		for (const [index, characters] of rest.entries()) {
			ids.push(
				await ctx.db.insert('SongLine', {
					parentRef: line.parentRef,
					songId: line.songId,
					order: orders[index]!,
					kindTag: 'lyric',
					characters
				})
			);
		}
		return ids;
	}
});

/** Adds a line to a block, or a loose line to the song, after `afterOrder` (default: at the end). */
export const addLine = authMutation({
	args: {
		parentRef: parentRefValidator,
		afterOrder: v.optional(v.number()),
		characters: v.optional(charactersValidator)
	},
	handler: async (ctx, { parentRef, afterOrder, characters }) => {
		const song = await requireParent(ctx, ctx.user, parentRef);
		const [order] = await ordersNextTo(ctx, parentRef, afterOrder);
		return await ctx.db.insert('SongLine', {
			parentRef,
			songId: song._id,
			order: order!,
			kindTag: 'lyric',
			characters: characters ?? []
		});
	}
});

/** Joins a line onto the end of the line above it in the same block (Backspace at a line's start). */
export const mergeLineUp = authMutation({
	args: { lineId: v.id('SongLine') },
	handler: async (ctx, { lineId }) => {
		const line = await requireLine(ctx, ctx.user, lineId);
		const { before } = await slotNextTo(ctx, line.parentRef, line.order, 'before');
		// The row above may be a block, when this is a loose line; then there's nothing to join.
		const previous =
			before === undefined
				? null
				: await ctx.db
						.query('SongLine')
						.withIndex('by_parentRef_and_order', (q) =>
							q.eq('parentRef', line.parentRef).eq('order', before)
						)
						.first();
		if (!previous) throw new ConvexError('NO_LINE_ABOVE');
		await ctx.db.patch('SongLine', previous._id, {
			characters: [...previous.characters, ...line.characters]
		});
		await ctx.db.delete('SongLine', lineId);
		return previous._id;
	}
});

/**
 * Deletes a line. `heirId` is the line after it when it starts a group: that line starts the group instead,
 * so the rest of the group doesn't fold into the one above.
 */
export const removeLine = authMutation({
	args: { lineId: v.id('SongLine'), heirId: v.optional(v.id('SongLine')) },
	handler: async (ctx, { lineId, heirId }) => {
		await requireLine(ctx, ctx.user, lineId);
		await ctx.db.delete('SongLine', lineId);
		if (heirId) await writeGroupMarks(ctx, ctx.user, [{ lineId: heirId, startsGroup: true }]);
		return null;
	}
});

/** Undoes removeLine: the line back in its place, and its group back from `heirId`. */
export const restoreLine = authMutation({
	args: {
		line: v.object({
			parentRef: parentRefValidator,
			order: v.number(),
			kindTag: convexTagValidator('SongLineKinds'),
			characters: charactersValidator,
			startsGroup: v.optional(v.boolean())
		}),
		heirId: v.optional(v.id('SongLine'))
	},
	handler: async (ctx, { line, heirId }) => {
		const song = await requireParent(ctx, ctx.user, line.parentRef);
		if (!Number.isFinite(line.order)) throw new ConvexError('INVALID_ORDER');
		const lineId = await ctx.db.insert('SongLine', { ...line, songId: song._id });
		if (heirId) await writeGroupMarks(ctx, ctx.user, [{ lineId: heirId, startsGroup: false }]);
		return lineId;
	}
});

const groupMarksValidator = v.array(
	v.object({ lineId: v.id('SongLine'), startsGroup: v.boolean() })
);

async function writeGroupMarks(
	ctx: MutationCtx,
	user: Doc<'User'>,
	marks: Infer<typeof groupMarksValidator>
) {
	if (marks.length > MAX_ROWS) throw new ConvexError('TOO_MANY_LINES');
	for (const { lineId, startsGroup } of marks) {
		await requireLine(ctx, user, lineId);
		await ctx.db.patch('SongLine', lineId, { startsGroup: startsGroup || undefined });
	}
}

/**
 * Sets or clears where line groups start (#lib/chart groupArrangement derives the groups). The editor sends
 * the marks for a selected range: its first line and the line after it start groups.
 */
export const setGroupMarks = authMutation({
	args: { marks: groupMarksValidator },
	handler: async (ctx, { marks }) => {
		await writeGroupMarks(ctx, ctx.user, marks);
		return null;
	}
});

/**
 * Moves a line within its song (its drag handle): within a block, to another block, or to or from a run of
 * loose lines. It lands just after `aboveId`, or just before `belowId` at the top of a block, or alone in an
 * empty block. Never into a repeat, which has no lines of its own. `marks` are the group marks that keep the
 * groups as they look after the drop (the editor works them out, as it does for setGroupMarks).
 */
export const moveLine = authMutation({
	args: {
		lineId: v.id('SongLine'),
		parentRef: parentRefValidator,
		aboveId: v.optional(v.id('SongLine')),
		belowId: v.optional(v.id('SongLine')),
		marks: groupMarksValidator
	},
	handler: async (ctx, { lineId, parentRef, aboveId, belowId, marks }) => {
		const line = await requireLine(ctx, ctx.user, lineId);
		const song = await requireParent(ctx, ctx.user, parentRef);
		if (song._id !== line.songId) throw new ConvexError('NOT_FOUND');
		const neighbourId = aboveId ?? belowId;
		const neighbour = neighbourId && (await requireLine(ctx, ctx.user, neighbourId));
		if (neighbour && (neighbour._id === lineId || neighbour.parentRef._id !== parentRef._id))
			throw new ConvexError('NOT_FOUND');
		const [order] = await ordersNextTo(
			ctx,
			parentRef,
			neighbour?.order,
			aboveId ? 'after' : 'before'
		);
		await ctx.db.patch('SongLine', lineId, { parentRef, order: order! });
		await writeGroupMarks(ctx, ctx.user, marks);
		return null;
	}
});

const cleanName = (name: string) => name.trim().slice(0, 100) || 'Untitled';

/**
 * A new block or interlude: empty at the end of the song, or made in place from `lineIds` (consecutive
 * lines of one block, or loose lines). Taken from the middle of a block, the lines below them move to a
 * second new block with the old one's name, so the song still reads in the same order. Not from a block
 * that's repeated: that would change every repeat.
 */
export const createSection = authMutation({
	args: {
		songId: v.id('Song'),
		name: v.string(),
		kindTag: convexTagValidator('SongSectionKinds'),
		lineIds: v.optional(v.array(v.id('SongLine')))
	},
	handler: async (ctx, { songId, name, kindTag, lineIds = [] }) => {
		await requireSongOwner(ctx, songId, ctx.user);
		if (lineIds.length > MAX_ROWS) throw new ConvexError('TOO_MANY_LINES');
		const songRef = { type: 'Song' as const, _id: songId };
		const lines: Doc<'SongLine'>[] = [];
		for (const lineId of lineIds) lines.push(await requireLine(ctx, ctx.user, lineId));
		lines.sort((a, b) => a.order - b.order);

		const insert = (order: number, sectionName = cleanName(name), tag = kindTag) =>
			ctx.db.insert('SongSection', { songId, name: sectionName, kindTag: tag, order });
		const moveInto = async (sectionId: Id<'SongSection'>, moved: Doc<'SongLine'>[]) => {
			for (const line of moved)
				await ctx.db.patch('SongLine', line._id, {
					parentRef: { type: 'SongSection', _id: sectionId }
				});
		};

		const first = lines[0];
		if (!first) return await insert((await ordersNextTo(ctx, songRef, undefined))[0]!);
		const parentRef = first.parentRef;
		if (lines.some((line) => line.songId !== songId || line.parentRef._id !== parentRef._id))
			throw new ConvexError('LINES_FROM_DIFFERENT_BLOCKS');

		if (parentRef.type === 'Song') {
			// Loose lines leave the song's order space, so the block takes the first one's place.
			const sectionId = await insert(first.order);
			await moveInto(sectionId, lines);
			return sectionId;
		}

		const source = await requireSection(ctx, ctx.user, parentRef._id);
		// Its repeats render its lines, so taking some out would change every repeat too.
		const repeat = await ctx.db
			.query('SongSection')
			.withIndex('by_repeatOfId', (q) => q.eq('repeatOfId', source._id))
			.first();
		if (repeat)
			throw new ConvexError(
				`“${source.name}” is repeated later, so making a block from it would change every repeat. Group the lines instead.`
			);
		const siblings = await ctx.db
			.query('SongLine')
			.withIndex('by_parentRef_and_order', (q) => q.eq('parentRef', parentRef))
			.take(MAX_ROWS);
		const isAbove = siblings.some((line) => line.order < first.order);
		const below = siblings.filter((line) => line.order > lines.at(-1)!.order);
		if (!isAbove) {
			// The head of the block: the new block goes just before it.
			const [order] = await ordersNextTo(ctx, songRef, source.order, 'before');
			const sectionId = await insert(order!);
			await moveInto(sectionId, lines);
			return sectionId;
		}
		const [order, continuationOrder] = await ordersNextTo(ctx, songRef, source.order, 'after', 2);
		const sectionId = await insert(order!);
		await moveInto(sectionId, lines);
		if (below.length)
			await moveInto(await insert(continuationOrder!, source.name, source.kindTag), below);
		return sectionId;
	}
});

export const renameSection = authMutation({
	args: { sectionId: v.id('SongSection'), name: v.string() },
	handler: async (ctx, { sectionId, name }) => {
		await requireSection(ctx, ctx.user, sectionId);
		await ctx.db.patch('SongSection', sectionId, { name: cleanName(name) });
		return null;
	}
});

/** Deletes a block; a trigger deletes its lines and its repeats. */
export const removeSection = authMutation({
	args: { sectionId: v.id('SongSection') },
	handler: async (ctx, { sectionId }) => {
		await requireSection(ctx, ctx.user, sectionId);
		await ctx.db.delete('SongSection', sectionId);
		return null;
	}
});

/** Plays a block again at the end of the song. The repeat shows its source's lines, so a fix lands in both. */
export const repeatSection = authMutation({
	args: { sectionId: v.id('SongSection') },
	handler: async (ctx, { sectionId }) => {
		const section = await requireSection(ctx, ctx.user, sectionId);
		const source =
			(section.repeatOfId && (await ctx.db.get('SongSection', section.repeatOfId))) || section;
		const [order] = await ordersNextTo(ctx, { type: 'Song', _id: section.songId }, undefined);
		return await ctx.db.insert('SongSection', {
			songId: section.songId,
			name: source.name,
			kindTag: source.kindTag,
			order: order!,
			repeatOfId: source._id
		});
	}
});

/** Moves blocks and loose lines within the song's shared order space (drag to reorder). */
export const reorder = authMutation({
	args: {
		songId: v.id('Song'),
		items: v.array(
			v.object({
				ref: v.union(discriminatedUnionItem('SongSection'), discriminatedUnionItem('SongLine')),
				order: v.number()
			})
		)
	},
	handler: async (ctx, { songId, items }) => {
		await requireSongOwner(ctx, songId, ctx.user);
		if (items.length > MAX_ROWS) throw new ConvexError('TOO_MANY_ITEMS');
		if (items.some(({ order }) => !Number.isFinite(order))) throw new ConvexError('INVALID_ORDER');
		for (const { ref, order } of items) {
			if (ref.type === 'SongSection') {
				const section = await ctx.db.get('SongSection', ref._id);
				if (section?.songId !== songId) throw new ConvexError('NOT_FOUND');
				await ctx.db.patch('SongSection', ref._id, { order });
			} else {
				const line = await ctx.db.get('SongLine', ref._id);
				if (line?.parentRef.type !== 'Song' || line.songId !== songId)
					throw new ConvexError('NOT_FOUND');
				await ctx.db.patch('SongLine', ref._id, { order });
			}
		}
		return null;
	}
});
