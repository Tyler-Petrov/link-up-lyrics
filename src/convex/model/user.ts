import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** The signed-in person's User row, or null when signed out or not synced yet. */
export async function currentUser(ctx: QueryCtx): Promise<Doc<'User'> | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;
	return await ctx.db
		.query('User')
		.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', identity.subject))
		.unique();
}

/**
 * Creates or refreshes the User row from the Clerk identity (the "convex" JWT template's name, email and
 * picture claims). Runs at the start of every authMutation and from `user.ensure`, which the app calls once
 * Clerk signs someone in, so queries can rely on the row existing. Pass a trigger-wrapped ctx: inserting a
 * User claims the invitations sent to their email (functions.ts).
 */
export async function ensureUser(ctx: MutationCtx): Promise<Doc<'User'>> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new ConvexError('NOT_SIGNED_IN');

	const name = identity.name ?? identity.nickname ?? identity.email ?? 'Musician';
	const email = identity.email?.toLowerCase();
	const imageUrl = identity.pictureUrl;
	const existing = await ctx.db
		.query('User')
		.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', identity.subject))
		.unique();

	if (existing) {
		if (existing.name !== name || existing.email !== email || existing.imageUrl !== imageUrl) {
			await ctx.db.patch('User', existing._id, { name, email, imageUrl });
			return { ...existing, name, email, imageUrl };
		}
		return existing;
	}

	const userId = await ctx.db.insert('User', {
		clerkUserId: identity.subject,
		name,
		email,
		imageUrl,
		planTag: 'none',
		paymentStatusTag: 'current'
	});
	return (await ctx.db.get('User', userId))!;
}
