import { v } from 'convex/values';
import { query } from './_generated/server';

/** Answers the browser's connection probe (#lib/connection.svelte.ts). The nonce makes each call a fresh query. */
export const ping = query({
	args: { nonce: v.string() },
	returns: v.null(),
	handler: () => null
});
