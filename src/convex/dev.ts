import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { env, internalAction, internalQuery } from './_generated/server';

/**
 * A five-minute sign-in link for `pnpm dev sign-in` and the dev server's Sign in button (scripts/dev-service.mjs),
 * so agents sign in without Google. Signs in as the given User, or the first one (the seed's), and lands on
 * `successUrl`. Clerk development instances only: a link into production would sign in as a real person.
 * src/routes/sign-in-token/[token] redeems it.
 */
export const createSignInLink = internalAction({
	args: { successUrl: v.string(), userId: v.optional(v.id('User')) },
	returns: v.string(),
	handler: async (ctx, { successUrl, userId }) => {
		if (!env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
			throw new ConvexError('Sign-in links only work with a Clerk development instance');
		}
		if (!successUrl.startsWith('/') || successUrl.startsWith('//')) {
			throw new ConvexError('successUrl must be a path on this site');
		}
		const clerkUserId = await ctx.runQuery(internal.dev.clerkUserId, { userId });
		if (!clerkUserId) throw new ConvexError('No such user');

		const response = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 5 * 60 })
		});
		if (!response.ok) {
			throw new Error(`Clerk sign_in_tokens failed: ${response.status} ${await response.text()}`);
		}
		const { token } = (await response.json()) as { token: string };
		// The dev server moves the link onto the worktree's own URL.
		const link = new URL(`/sign-in-token/${token}`, env.SITE_URL ?? 'http://localhost:5173');
		link.searchParams.set('url', successUrl);
		return link.href;
	}
});

export const clerkUserId = internalQuery({
	args: { userId: v.optional(v.id('User')) },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, { userId }) => {
		const user = userId ? await ctx.db.get('User', userId) : await ctx.db.query('User').first();
		return user?.clerkUserId ?? null;
	}
});
