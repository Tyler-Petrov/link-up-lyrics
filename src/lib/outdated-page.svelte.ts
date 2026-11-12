import { updated } from '$app/state';

/** What a page from before a release hits: Convex functions the release renamed or removed, and code files it
 *  replaced (in Chrome's, Safari's, then Firefox's words). In production, Convex only tells the browser a query
 *  failed with a "Server Error", so any of those could mean the page is out of date. */
const outdatedPageErrors = [
	/^\[CONVEX Q\(.*\] Server Error/,
	/Could not find public function/,
	/Failed to fetch dynamically imported module/,
	/Importing a module script failed/,
	/error loading dynamically imported module/
];

let hitOutdatedPageError = $state(false);

/**
 * Remembers an error that could mean this page is from before a release, and checks whether a new version is
 * out. Returns whether one is. Convex deploys before the new version goes live, so the check can come back
 * false and {@link outdatedPageNeedsReload} turns true at a later one.
 */
export async function noteOutdatedPageError(error: unknown) {
	if (!(
		error instanceof Error && outdatedPageErrors.some((pattern) => pattern.test(error.message))
	))
		return false;
	hitOutdatedPageError = true;
	return await updated.check();
}

/** Whether this page hit an error from a release that's now live, so reloading loads the version that fixes it. */
export function outdatedPageNeedsReload() {
	return hitOutdatedPageError && updated.current;
}
