import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { noteOutdatedPageError } from '#lib/outdated-page.svelte.js';
import { captureException, initPosthog } from '#lib/posthog-browser.js';

export const init: ClientInit = () => {
	initPosthog();
};

export const handleError: HandleClientError = async ({ error, kind }) => {
	// Errors that reach an error boundary come through here, so the page reloads once the new version is live
	// (+layout.svelte). Those aren't bugs to track, and neither are SvelteKit's own, like a page that doesn't exist.
	const outdated = await noteOutdatedPageError(error);
	if (kind === 'unknown' && !outdated) captureException(error);
};
