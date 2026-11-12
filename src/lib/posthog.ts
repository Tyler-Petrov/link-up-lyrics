/*
 * PostHog analytics and error tracking, in the browser (posthog-browser.ts) and on the server (hooks.server.ts).
 * Off wherever PUBLIC_POSTHOG_KEY isn't set: development, previews, and production until the project exists.
 */
export const POSTHOG_HOST = 'https://us.i.posthog.com';

/** Sign-in links carry a Clerk sign-in token in their path. Works on full URLs and pathnames. */
export function redactSignInToken(url: string) {
	return url.replace(/\/sign-in-token\/[^/?#]+/, '/sign-in-token/:token');
}
