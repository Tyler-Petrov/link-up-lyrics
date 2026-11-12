import { buildClerkProps } from 'svelte-clerk/server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const auth = locals.auth();
	return {
		/** The Clerk user the server rendered for. hooks.server.ts has made sure they have a User row. */
		clerkUserId: auth.userId ?? undefined,
		// The browser authenticates Convex with this until Clerk loads, which starts after hydration.
		convexToken: locals.convexToken,
		...buildClerkProps(auth)
	};
};
