import type { HandleClientError } from '@sveltejs/kit/hooks';
import { noteOutdatedPageError } from '#lib/outdated-page.svelte.js';

export const handleError: HandleClientError = async ({ error }) => {
	// Errors that reach an error boundary come through here, so the page reloads once the new version is live
	// (+layout.svelte).
	await noteOutdatedPageError(error);
};
