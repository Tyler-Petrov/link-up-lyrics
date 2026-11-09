/*
 * Billing state on the User row. Clerk Billing owns the subscription; its webhook (http.ts) mirrors it here,
 * and server checks read only this (model/billing.ts). Comps are ours and independent of Clerk. §13.
 */
import { ConvexError, v } from 'convex/values';
import type { MutationCtx } from './_generated/server';
import { internalMutation } from './functions';
import { DAY, GRACE_DAYS } from './model/billing';
import { epoch } from './validators';

/** The Clerk Billing plan slug that grants hosting. */
const PRO_PLAN_SLUG = 'pro';

/**
 * Free access until a date, for camps, pastors, beta testers. The reason is required so the list stays
 * auditable, and it expires on its own. §13.2.
 *
 *   pnpm exec convex run billing:comp '{"email":"…","untilEpoch":1798761600000,"reason":"Summer camp 2027"}'
 */
export const comp = internalMutation({
	args: { email: v.string(), untilEpoch: epoch(), reason: v.string() },
	handler: async (ctx, { email, untilEpoch, reason }) => {
		const user = await userByEmail(ctx, email);
		await ctx.db.patch('User', user._id, { compedUntilEpoch: untilEpoch, compReason: reason });
		return user._id;
	}
});

/**
 * For trying the trial banner without Clerk: a free trial ending at `endsEpoch`, as the webhook records one,
 * or back to never subscribed without it. A live comp outranks a trial, so lapse it first (billing:comp with
 * a past untilEpoch).
 *
 *   pnpm exec convex run billing:trial '{"email":"…","endsEpoch":1798761600000}'
 */
export const trial = internalMutation({
	args: { email: v.string(), endsEpoch: v.optional(epoch()) },
	handler: async (ctx, { email, endsEpoch }) => {
		const user = await userByEmail(ctx, email);
		await ctx.db.patch('User', user._id, {
			planTag: endsEpoch ? 'trialing' : 'none',
			trialEndsEpoch: endsEpoch
		});
		return user._id;
	}
});

async function userByEmail(ctx: MutationCtx, email: string) {
	const user = await ctx.db
		.query('User')
		.withIndex('by_email', (q) => q.eq('email', email.trim().toLowerCase()))
		.first();
	if (!user) throw new ConvexError(`No user with email ${email}`);
	return user;
}

/**
 * One Clerk Billing subscription-item event, already verified (http.ts). Only the Pro plan's items matter;
 * the free default plan's events are ignored.
 *
 * - active: paying (or trialing, until the period end) and the card is fine. Clears any payment failure.
 * - pastDue: a renewal failed. Hosting carries on for GRACE_DAYS, pinned at the first failure. §13.3.2.
 * - ended: trial over or cancellation took effect. Hard stop, no grace: they decided.
 *
 * Svix retries can deliver an older event after a newer one, so an event older than the last one applied is
 * ignored.
 */
export const applySubscriptionItemEvent = internalMutation({
	args: {
		type: v.string(),
		eventEpoch: epoch(),
		clerkUserId: v.string(),
		planSlug: v.string(),
		isFreeTrial: v.boolean(),
		periodEndEpoch: v.optional(epoch())
	},
	handler: async (
		ctx,
		{ type, eventEpoch, clerkUserId, planSlug, isFreeTrial, periodEndEpoch }
	) => {
		if (planSlug !== PRO_PLAN_SLUG) return null;
		const user = await ctx.db
			.query('User')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.unique();
		// Subscribing needs a signed-in session, which creates the row first. Nothing to mirror otherwise.
		if (!user) {
			console.warn(`Billing event ${type} for unknown Clerk user ${clerkUserId}`);
			return null;
		}
		if (eventEpoch < (user.billingEventEpoch ?? 0)) return null;
		const paymentCurrent = {
			paymentStatusTag: 'current' as const,
			pastDueSinceEpoch: undefined,
			graceEndsEpoch: undefined,
			paymentFailureReason: undefined
		};
		switch (type) {
			case 'subscriptionItem.active':
				await ctx.db.patch('User', user._id, {
					planTag: isFreeTrial ? 'trialing' : 'pro',
					trialEndsEpoch: isFreeTrial ? periodEndEpoch : undefined,
					billingEventEpoch: eventEpoch,
					...paymentCurrent
				});
				break;
			case 'subscriptionItem.pastDue': {
				const failedEpoch = Date.now();
				await ctx.db.patch('User', user._id, {
					paymentStatusTag: 'pastDue',
					billingEventEpoch: eventEpoch,
					// Dunning retries fire this repeatedly; the first failure sets the clock.
					pastDueSinceEpoch: user.pastDueSinceEpoch ?? failedEpoch,
					graceEndsEpoch: user.graceEndsEpoch ?? failedEpoch + GRACE_DAYS * DAY
				});
				break;
			}
			case 'subscriptionItem.ended':
				await ctx.db.patch('User', user._id, {
					planTag: 'expired',
					trialEndsEpoch: undefined,
					billingEventEpoch: eventEpoch,
					...paymentCurrent
				});
				break;
		}
		return null;
	}
});
