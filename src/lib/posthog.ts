/*
 * PostHog analytics and error tracking, in the browser (posthog-browser.ts) and on the server (hooks.server.ts).
 * Off wherever PUBLIC_POSTHOG_KEY isn't set: development, previews (their workflow builds without it), and
 * production until the project exists.
 */
export const POSTHOG_HOST = 'https://us.i.posthog.com';
