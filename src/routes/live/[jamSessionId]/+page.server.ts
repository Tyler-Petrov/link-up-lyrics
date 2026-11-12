import { ViewerCookies } from '#lib/components/live/viewer-settings.svelte.js';
import type { PageServerLoad } from './$types';

/* This phone's view mode and text size, so the words render that way from the first paint. */
export const load: PageServerLoad = ({ cookies }) => ({
	viewer: { mode: cookies.get(ViewerCookies.mode), size: cookies.get(ViewerCookies.size) }
});
