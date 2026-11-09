/*
 * Who may see and change what. No sharing in v1, so access is computed, not stored: you can read a song you
 * own or one on the setlist of a session you're in; a session role comes from ownership or an accepted
 * membership. §4.5, §12.
 */
import { ConvexError } from 'convex/values';
import { atTagOrHigher, type ConstantTag } from '../constants';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { currentUser } from './user';

type Role = ConstantTag<'JamSessionRoles'>;

/** The user's role in the session: "owner" for its owner, else their accepted membership's role. */
export async function jamSessionRole(
	ctx: QueryCtx,
	session: Doc<'JamSession'>,
	user: Doc<'User'> | null
): Promise<Role | undefined> {
	if (!user) return undefined;
	if (session.ownerId === user._id) return 'owner';
	const memberships = await ctx.db
		.query('JamSessionMember')
		.withIndex('by_jamSessionId_and_userId', (q) =>
			q.eq('jamSessionId', session._id).eq('userId', user._id)
		)
		.take(10);
	return memberships.find((membership) => membership.statusTag === 'accepted')?.roleTag;
}

/** The signed-in user's session and role, or throws when they're below `minimum`. */
export async function requireJamSessionRole(
	ctx: QueryCtx,
	jamSessionId: Id<'JamSession'>,
	minimum: Role
) {
	const user = await currentUser(ctx);
	if (!user) throw new ConvexError('NOT_SIGNED_IN');
	const session = await ctx.db.get('JamSession', jamSessionId);
	if (!session) throw new ConvexError('NOT_FOUND');
	const role = await jamSessionRole(ctx, session, user);
	if (!atTagOrHigher('JamSessionRoles', role, minimum))
		throw new ConvexError('INSUFFICIENT_PERMISSION');
	return { user, session, role: role! };
}

/** Owner, or on the setlist of a session the user is in. */
export async function canReadSong(ctx: QueryCtx, song: Doc<'Song'>, user: Doc<'User'> | null) {
	if (!user) return false;
	if (song.ownerId === user._id) return true;
	const items = await ctx.db
		.query('JamSessionItem')
		.withIndex('by_contentRef', (q) => q.eq('contentRef', { type: 'Song', _id: song._id }))
		.take(100);
	for (const item of items) {
		const session = await ctx.db.get('JamSession', item.jamSessionId);
		if (session && (await jamSessionRole(ctx, session, user))) return true;
	}
	return false;
}

/** The song, when the user owns it. Editing is owner-only in v1. */
export async function requireSongOwner(ctx: QueryCtx, songId: Id<'Song'>, user: Doc<'User'>) {
	const song = await ctx.db.get('Song', songId);
	if (!song || song.ownerId !== user._id) throw new ConvexError('NOT_FOUND');
	return song;
}
