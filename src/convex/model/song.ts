import { buildArrangement, ordersAfter, type ParsedSong } from '#convex/shared/chart/index.js';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** Upper bound on a song's sections and lines read in one query. A long hymn is well under 200 lines. */
const MAX_ROWS = 500;

/**
 * A song's metadata plus its blocks in play order (#convex/shared/chart buildArrangement): one index read for its
 * sections, one for its loose lines, one per section. §4.3. Derive line groups with groupArrangement.
 */
export async function loadArrangement(ctx: QueryCtx, song: Doc<'Song'>) {
	const sections = await ctx.db
		.query('SongSection')
		.withIndex('by_songId_and_order', (q) => q.eq('songId', song._id))
		.take(MAX_ROWS);
	const looseLines = await linesOf(ctx, { type: 'Song', _id: song._id });
	const linesBySection = new Map<Id<'SongSection'>, Doc<'SongLine'>[]>();
	for (const section of sections) {
		if (section.repeatOfId) continue; // repeats have no lines of their own
		linesBySection.set(section._id, await linesOf(ctx, { type: 'SongSection', _id: section._id }));
	}
	return { song, blocks: buildArrangement(sections, looseLines, linesBySection) };
}
export type SongArrangement = Awaited<ReturnType<typeof loadArrangement>>;

async function linesOf(ctx: QueryCtx, parentRef: Doc<'SongLine'>['parentRef']) {
	return await ctx.db
		.query('SongLine')
		.withIndex('by_parentRef_and_order', (q) => q.eq('parentRef', parentRef))
		.take(MAX_ROWS);
}

/** Inserts a parsed song (paste, ChordPro import, seed). */
export async function insertParsedSong(
	ctx: MutationCtx,
	ownerId: Id<'User'>,
	parsed: ParsedSong,
	metadata: {
		title: string;
		artist?: string;
		copyrightSourceTag: Doc<'Song'>['copyrightSourceTag'];
		songwriters?: string[];
		copyrightLine?: string;
	}
) {
	const songId = await ctx.db.insert('Song', {
		title: metadata.title,
		artist: metadata.artist,
		ownerId,
		originalKeyTag: parsed.keyTag,
		capo: parsed.capo,
		copyrightSourceTag: metadata.copyrightSourceTag,
		copyrightLine: metadata.copyrightLine,
		songwriters: metadata.songwriters ?? [],
		updatedEpoch: Date.now()
	});

	const sectionIds: Id<'SongSection'>[] = [];
	const orders = ordersAfter(undefined, parsed.blocks.length);
	for (const [index, block] of parsed.blocks.entries()) {
		const sectionId = await ctx.db.insert('SongSection', {
			songId,
			name: block.name,
			kindTag: block.kindTag,
			order: orders[index]!,
			repeatOfId: block.repeatOf === undefined ? undefined : sectionIds[block.repeatOf]
		});
		sectionIds.push(sectionId);
		const lineOrders = ordersAfter(undefined, block.lines.length);
		for (const [lineIndex, line] of block.lines.entries()) {
			await ctx.db.insert('SongLine', {
				parentRef: { type: 'SongSection', _id: sectionId },
				songId,
				order: lineOrders[lineIndex]!,
				kindTag: line.kindTag,
				characters: line.characters,
				startsGroup: line.startsGroup
			});
		}
	}
	return songId;
}

/** Bumps the song's "last edited" time. Called from triggers, so it tolerates a song mid-delete. */
export async function touchSong(ctx: MutationCtx, songId: Id<'Song'>) {
	const song = await ctx.db.get('Song', songId);
	if (song) await ctx.db.patch('Song', songId, { updatedEpoch: Date.now() });
}
