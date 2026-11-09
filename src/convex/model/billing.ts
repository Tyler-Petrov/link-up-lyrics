/*
 * You pay to host; everything else is free. Hosting is gated at exactly three points: creating a jam session,
 * taking one live, and inviting. Each checks the session OWNER's plan, whoever is acting. Pure functions over
 * the User row (which the Clerk billing webhook and billing:comp write), so the app reuses them to show the
 * same answer the server enforces. §13.3.
 */
import { ConvexError } from 'convex/values';
import { constantByTag } from '../constants';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

export const GRACE_DAYS = 7;
export const DAY = 24 * 60 * 60 * 1000;
/* The trial banner shows from day 10 of the 14-day trial. §13.1. */
const TRIAL_WARNING_DAYS = 4;

type BillingFields = Pick<
	Doc<'User'>,
	'planTag' | 'paymentStatusTag' | 'graceEndsEpoch' | 'compedUntilEpoch' | 'trialEndsEpoch'
>;

/** The plan that applies right now: a live comp counts as Pro, whatever Clerk says. §13.2. */
export function effectivePlanTag(user: BillingFields, now: number) {
	return (user.compedUntilEpoch ?? 0) > now ? 'pro' : user.planTag;
}

/** When their free trial ends, if it ends within TRIAL_WARNING_DAYS and nothing else covers them. */
export function trialEndingSoonEpoch(user: BillingFields, now: number) {
	if (effectivePlanTag(user, now) !== 'trialing' || !user.trialEndsEpoch) return undefined;
	return user.trialEndsEpoch - now <= TRIAL_WARNING_DAYS * DAY ? user.trialEndsEpoch : undefined;
}

/** Whether this person's sessions can be created, taken live and invited to. */
export function canHost(user: BillingFields, now: number) {
	if (constantByTag('SubscriptionPlans', effectivePlanTag(user, now)).canHostSessions) return true;
	// A failed card is not a decision. Honour the window we promised. §13.3.2.
	return user.paymentStatusTag === 'pastDue' && (user.graceEndsEpoch ?? 0) > now;
}

/**
 * Throws SUBSCRIPTION_REQUIRED unless `owner` can host. Pass the session's owner (the actor, when creating),
 * never just whoever tapped the button: hostability follows the owner. §13.3.
 */
export async function requireCanHost(_ctx: QueryCtx, owner: Doc<'User'>) {
	if (!canHost(owner, Date.now())) throw new ConvexError('SUBSCRIPTION_REQUIRED');
}
