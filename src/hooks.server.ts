// Clerk's server half plus the SSR Convex token, the Jairus pattern. Clerk finishes its sign-in handshake here
// and tells us who's asking; their "convex" JWT then authenticates every Convex query the page renders on
// the server (withServerConvexToken), and is handed to the browser so Convex is authenticated before Clerk's
// script loads.
import { sequence, type HandleServerError } from '@sveltejs/kit/hooks';
import { PostHog } from 'posthog-node';
import { withClerkHandler } from 'svelte-clerk/server';
import { withServerConvexToken } from 'convex-svelte/sveltekit/server';
import { ConvexHttpClient } from 'convex/browser';
import { CLERK_SECRET_KEY } from '$app/env/private';
import {
	PUBLIC_CLERK_PUBLISHABLE_KEY,
	PUBLIC_CONVEX_URL,
	PUBLIC_POSTHOG_KEY
} from '$app/env/public';
import { api } from '#convex/_generated/api.js';
import { POSTHOG_HOST, redactSignInToken } from '#lib/posthog.js';

/** Marks the browser whose Clerk user already has a User row, so the sync below runs once, not per request. */
const SYNCED_COOKIE = 'lul-user-synced';

export const handle = sequence(
	withClerkHandler({ secretKey: CLERK_SECRET_KEY, publishableKey: PUBLIC_CLERK_PUBLISHABLE_KEY }),
	async ({ event, resolve }) => {
		const auth = event.locals.auth();
		const convexToken = auth.userId
			? ((await auth.getToken({ template: 'convex' })) ?? undefined)
			: undefined;
		event.locals.convexToken = convexToken;

		// Signed-in pages render on the server, and their queries expect a User row (authQuery).
		if (auth.userId && convexToken && event.cookies.get(SYNCED_COOKIE) !== auth.userId) {
			const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL, { auth: convexToken });
			await convex.mutation(api.user.ensure, {});
			event.cookies.set(SYNCED_COOKIE, auth.userId, {
				path: '/',
				httpOnly: true,
				maxAge: 60 * 60 * 24
			});
		}

		return withServerConvexToken(convexToken, () => resolve(event));
	}
);

/** Server errors go to PostHog's error tracking, sent before the Worker's request ends. */
export const handleError: HandleServerError = async ({ error, event, kind }) => {
	// Only bugs: not errors thrown on purpose with error(), or SvelteKit's own, like a page that doesn't exist.
	if (kind !== 'unknown' || !PUBLIC_POSTHOG_KEY) return;
	const posthog = new PostHog(PUBLIC_POSTHOG_KEY, {
		host: POSTHOG_HOST,
		flushAt: 1,
		flushInterval: 0
	});
	try {
		await posthog.captureExceptionImmediate(error, event.locals.auth().userId ?? undefined, {
			$current_url: redactSignInToken(event.url.href)
		});
	} catch (posthogError) {
		console.error('Failed to report a server error to PostHog', posthogError);
	}
};
