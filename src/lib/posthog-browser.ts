import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_KEY } from '$app/env/public';
import { POSTHOG_HOST, redactSignInToken } from './posthog.js';

export function initPosthog() {
	if (!PUBLIC_POSTHOG_KEY) return;
	posthog.init(PUBLIC_POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		// Pageviews on client-side navigation, and exceptions nobody caught.
		defaults: '2026-08-30',
		capture_exceptions: true,
		person_profiles: 'identified_only',
		before_send: (event) => {
			if (!event) return event;
			for (const key of ['$current_url', '$pathname', '$referrer', '$prev_pageview_pathname']) {
				const value = event.properties[key];
				if (typeof value === 'string') event.properties[key] = redactSignInToken(value);
			}
			return event;
		}
	});
}

/** Ties events to the signed-in Clerk user, or starts a fresh anonymous person on sign-out. */
export function identify(clerkUserId: string | undefined) {
	if (!PUBLIC_POSTHOG_KEY) return;
	if (clerkUserId) posthog.identify(clerkUserId);
	else if (posthog._isIdentified()) posthog.reset();
}

export function captureException(error: unknown) {
	if (PUBLIC_POSTHOG_KEY) posthog.captureException(error);
}
