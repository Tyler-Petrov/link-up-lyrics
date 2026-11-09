/*
 * The band: the owner invites people by email, they accept or decline at /invitations, and the owner can
 * promote, remove, or cancel. Someone invited before they have an account gets a Clerk application
 * invitation, and their User row claims the invitation when it's created (trigger in functions.ts). §14.2–14.3.
 */
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { env, internalAction, type MutationCtx } from './_generated/server';
import { rateLimiter } from './components';
import { authMutation, authQuery, valibotMutation } from './functions';
import { inviteSchema } from './forms/invitation';
import { requireJamSessionRole } from './model/access';
import { requireCanHost } from './model/billing';

const MAX_BAND = 200;

/**
 * The session's owner and its current band (invited and accepted), for the console's Band panel. Leader+;
 * emails only for the owner, who manages the band.
 */
export const listForSession = authQuery({
	args: { jamSessionId: v.id('JamSession') },
	handler: async (ctx, { jamSessionId }) => {
		const { session, role } = await requireJamSessionRole(ctx, jamSessionId, 'leader');
		const owner = (await ctx.db.get('User', session.ownerId))!;
		const canManage = role === 'owner';
		const members = [];
		for (const statusTag of ['accepted', 'invited'] as const) {
			const rows = await ctx.db
				.query('JamSessionMember')
				.withIndex('by_jamSessionId_and_statusTag', (q) =>
					q.eq('jamSessionId', jamSessionId).eq('statusTag', statusTag)
				)
				.take(MAX_BAND);
			for (const { invitedEmail, ...member } of rows) {
				const user = member.userId && (await ctx.db.get('User', member.userId));
				members.push({
					...member,
					name: user ? user.name : undefined,
					email: canManage ? (user ? user.email : invitedEmail) : undefined,
					imageUrl: user ? user.imageUrl : undefined
				});
			}
		}
		return {
			owner: {
				name: owner.name,
				email: canManage ? owner.email : undefined,
				imageUrl: owner.imageUrl
			},
			canManage,
			members
		};
	}
});

/** The caller's pending invitations, newest first. Also the nav badge's count. */
export const listMine = authQuery({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db
			.query('JamSessionMember')
			.withIndex('by_userId_and_statusTag', (q) =>
				q.eq('userId', ctx.user._id).eq('statusTag', 'invited')
			)
			.order('desc')
			.take(100);
		const invitations = [];
		for (const row of rows) {
			const session = await ctx.db.get('JamSession', row.jamSessionId);
			if (!session) continue;
			const invitedBy = await ctx.db.get('User', row.invitedByUserId);
			invitations.push({
				_id: row._id,
				invitedEpoch: row.invitedEpoch,
				jamSessionName: session.name,
				invitedByName: invitedBy?.name ?? 'Someone'
			});
		}
		return invitations;
	}
});

/**
 * Invites an email to the band. Re-inviting someone who declined or was removed reuses their row. Inviting
 * is one of the three hosting gates, so it follows the owner's plan. §13.3.
 */
export const invite = valibotMutation({
	schema: inviteSchema,
	handler: async (ctx, { jamSessionId: rawId, email }) => {
		const jamSessionId = ctx.db.normalizeId('JamSession', rawId);
		if (!jamSessionId) throw new ConvexError('NOT_FOUND');
		const { user: owner } = await requireJamSessionRole(ctx, jamSessionId, 'owner');
		await requireCanHost(ctx, owner);
		if (email === owner.email) throw new ConvexError('You’re already in your own band');
		await rateLimiter.limit(ctx, 'invite', { key: owner._id, throws: true });

		const invitee = await ctx.db
			.query('User')
			.withIndex('by_email', (q) => q.eq('email', email))
			.first();
		const existing = invitee
			? await ctx.db
					.query('JamSessionMember')
					.withIndex('by_jamSessionId_and_userId', (q) =>
						q.eq('jamSessionId', jamSessionId).eq('userId', invitee._id)
					)
					.first()
			: (
					await ctx.db
						.query('JamSessionMember')
						.withIndex('by_invitedEmail', (q) => q.eq('invitedEmail', email))
						.take(MAX_BAND)
				).find((row) => row.jamSessionId === jamSessionId);

		const invitation = {
			statusTag: 'invited' as const,
			roleTag: 'player' as const,
			invitedByUserId: owner._id,
			invitedEpoch: Date.now(),
			respondedEpoch: undefined
		};
		if (existing) {
			if (existing.statusTag === 'invited' || existing.statusTag === 'accepted')
				throw new ConvexError('They’re already in the band or invited');
			await ctx.db.patch('JamSessionMember', existing._id, invitation);
		} else {
			await ctx.db.insert('JamSessionMember', {
				jamSessionId,
				// Set now if they have an account; otherwise their User row claims it on sign-up.
				userId: invitee?._id,
				invitedEmail: invitee ? undefined : email,
				...invitation
			});
		}

		// No account yet? Clerk owns the email and the sign-up link.
		if (!invitee)
			await ctx.scheduler.runAfter(0, internal.invitation.sendClerkInvitation, { email });
		return null;
	}
});

/**
 * A Clerk application invitation (not an Organization one): Clerk sends the email and the sign-up link.
 * Inert unless CLERK_INVITATIONS_ENABLED is "true", so dev and testing never email anyone.
 */
export const sendClerkInvitation = internalAction({
	args: { email: v.string() },
	handler: async (_ctx, { email }) => {
		if (env.CLERK_INVITATIONS_ENABLED !== 'true' || !env.CLERK_SECRET_KEY) {
			console.log('Clerk invitations are off; not emailing the invitee');
			return null;
		}
		const response = await fetch('https://api.clerk.com/v1/invitations', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email_address: email,
				redirect_url: env.SITE_URL ? `${env.SITE_URL}/invitations` : undefined,
				// Someone invited to two bands before signing up already has a pending invitation.
				ignore_existing: true
			})
		});
		if (!response.ok) throw new Error(`Clerk invitation failed: ${response.status}`);
		return null;
	}
});

/** The caller's own pending invitation. */
async function requireMyInvitation(
	ctx: MutationCtx & { user: Doc<'User'> },
	memberId: Id<'JamSessionMember'>
) {
	const member = await ctx.db.get('JamSessionMember', memberId);
	if (!member || member.userId !== ctx.user._id || member.statusTag !== 'invited')
		throw new ConvexError('That invitation is no longer open');
	return member;
}

export const accept = authMutation({
	args: { memberId: v.id('JamSessionMember') },
	handler: async (ctx, { memberId }) => {
		const member = await requireMyInvitation(ctx, memberId);
		await ctx.db.patch('JamSessionMember', memberId, {
			statusTag: 'accepted',
			respondedEpoch: Date.now()
		});
		return member.jamSessionId;
	}
});

export const decline = authMutation({
	args: { memberId: v.id('JamSessionMember') },
	handler: async (ctx, { memberId }) => {
		await requireMyInvitation(ctx, memberId);
		await ctx.db.patch('JamSessionMember', memberId, {
			statusTag: 'declined',
			respondedEpoch: Date.now()
		});
		return null;
	}
});

/** A member row of a session the caller owns. */
async function requireOwnedMember(ctx: MutationCtx, memberId: Id<'JamSessionMember'>) {
	const member = await ctx.db.get('JamSessionMember', memberId);
	if (!member) throw new ConvexError('NOT_FOUND');
	await requireJamSessionRole(ctx, member.jamSessionId, 'owner');
	return member;
}

/** Removes a member, or cancels an invitation. They can be invited again later. Owner only. */
export const remove = authMutation({
	args: { memberId: v.id('JamSessionMember') },
	handler: async (ctx, { memberId }) => {
		await requireOwnedMember(ctx, memberId);
		await ctx.db.patch('JamSessionMember', memberId, { statusTag: 'removed' });
		return null;
	}
});

/** Promotes a member to leader (runs the setlist and focus) or back to player. Owner only. */
export const setRole = authMutation({
	args: {
		memberId: v.id('JamSessionMember'),
		roleTag: v.union(v.literal('player'), v.literal('leader'))
	},
	handler: async (ctx, { memberId, roleTag }) => {
		await requireOwnedMember(ctx, memberId);
		await ctx.db.patch('JamSessionMember', memberId, { roleTag });
		return null;
	}
});
