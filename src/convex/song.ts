import { ConvexError, v } from 'convex/values';
import { parseSongText } from '#convex/shared/chart/index.js';
import { query } from './_generated/server';
import { authMutation, authQuery, valibotMutation } from './functions';
import { createSongFromTextSchema, songMetadataSchema } from './forms/song';
import { canReadSong, requireSongOwner } from './model/access';
import { insertParsedSong, loadArrangement } from './model/song';
import { currentUser } from './model/user';
import { rateLimiter } from './components';

/** The signed-in person's songs, most recently edited first, or title matches when searching. */
export const listMine = authQuery({
	args: { search: v.optional(v.string()) },
	handler: async (ctx, { search }) => {
		const term = search?.trim();
		if (term) {
			return await ctx.db
				.query('Song')
				.withSearchIndex('search_title', (q) => q.search('title', term).eq('ownerId', ctx.user._id))
				.take(50);
		}
		return await ctx.db
			.query('Song')
			.withIndex('by_ownerId_and_updatedEpoch', (q) => q.eq('ownerId', ctx.user._id))
			.order('desc')
			.take(500);
	}
});

/**
 * A song with its blocks in play order, or null when it doesn't exist or the caller can't read it. Takes the
 * id as a string because it comes straight from the URL. `canEdit` is true for the owner.
 */
export const getArrangement = query({
	args: { songId: v.string() },
	handler: async (ctx, args) => {
		const songId = ctx.db.normalizeId('Song', args.songId);
		const song = songId && (await ctx.db.get('Song', songId));
		if (!song) return null;
		const user = await currentUser(ctx);
		if (!(await canReadSong(ctx, song, user))) return null;
		const owner = await ctx.db.get('User', song.ownerId);
		return {
			...(await loadArrangement(ctx, song)),
			canEdit: song.ownerId === user?._id,
			/* The owner's church license, printed with the credits. §18.7. */
			ccliLicenseNumber: owner?.ccliLicenseNumber
		};
	}
});

/** Pasted words (and chords) → a new song. Blank lines split blocks; `[G]` brackets become chords. */
export const createFromText = valibotMutation({
	schema: createSongFromTextSchema,
	handler: async (ctx, data) => {
		await rateLimiter.limit(ctx, 'createSong', { key: ctx.user._id, throws: true });
		const parsed = parseSongText(data.text);
		return await insertParsedSong(ctx, ctx.user._id, parsed, {
			title: data.title || parsed.title || 'Untitled song',
			artist: data.artist || parsed.artist,
			// Pasted songs are usually someone else's; say so until the owner labels it. §18.6.
			copyrightSourceTag: 'unknown'
		});
	}
});

export const updateMetadata = valibotMutation({
	schema: songMetadataSchema,
	handler: async (ctx, data) => {
		const songId = ctx.db.normalizeId('Song', data.songId);
		if (!songId) throw new ConvexError('NOT_FOUND');
		await requireSongOwner(ctx, songId, ctx.user);
		await ctx.db.patch('Song', songId, {
			title: data.title,
			artist: data.artist || undefined,
			originalKeyTag: data.originalKeyTag,
			capo: data.capo || undefined,
			copyrightSourceTag: data.copyrightSourceTag,
			ccliSongNumber: data.ccliSongNumber || undefined,
			copyrightLine: data.copyrightLine || undefined,
			songwriters: data.songwriters,
			updatedEpoch: Date.now()
		});
		return songId;
	}
});

/** Deletes the song; a trigger removes its sections, lines and setlist appearances. */
export const remove = authMutation({
	args: { songId: v.id('Song') },
	handler: async (ctx, { songId }) => {
		await requireSongOwner(ctx, songId, ctx.user);
		await ctx.db.delete('Song', songId);
		return null;
	}
});
