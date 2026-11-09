<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setupAuth, useAuth, useConvexClient } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk/client';
	import { api } from '#convex/_generated/api.js';
	import { setAccount } from '#lib/account.svelte.js';

	type Props = {
		/** Whether the server rendered for a signed-in person. */
		isAuthenticated: boolean;
		/** The Convex token the server rendered with. */
		serverToken: string | undefined;
		/** The Clerk user the server rendered for; the server already synced their User row. */
		serverClerkUserId: string | undefined;
		children: Snippet;
	};
	let { isAuthenticated, serverToken, serverClerkUserId, children }: Props = $props();

	// Hands Clerk's session to Convex through Clerk's "convex" JWT template. From Jairus.
	const clerk = useClerkContext();
	const clerkLoaded = new Promise<void>((resolve) => {
		$effect(() => {
			if (clerk.isLoaded) resolve();
		});
	});

	setupAuth(
		() => ({
			isLoading: !clerk.isLoaded,
			isAuthenticated: Boolean(clerk.session),
			fetchAccessToken: async ({ forceRefreshToken }) => {
				// Clerk starts loading after hydration, so a query hydration waits on can't wait for Clerk.
				// Until it loads, use the token the server rendered with.
				if (!clerk.isLoaded && serverToken && !forceRefreshToken) return serverToken;
				await clerkLoaded;
				return (await clerk.session?.getToken({ template: 'convex' })) ?? null;
			}
		}),
		// svelte-ignore state_referenced_locally
		{ initialState: { isAuthenticated } }
	);

	// Someone who signs in here (rather than arriving signed in) gets their User row before account pages render.
	const client = useConvexClient();
	const convexAuth = useAuth();
	const clerkUserId = $derived(clerk.isLoaded ? clerk.auth.userId : serverClerkUserId);
	// svelte-ignore state_referenced_locally
	let syncedClerkUserId = $state(serverClerkUserId);
	$effect(() => {
		const userId = clerkUserId;
		if (!userId || userId === syncedClerkUserId || !convexAuth.isAuthenticated) return;
		void client.mutation(api.user.ensure, {}).then(() => {
			if (clerkUserId === userId) syncedClerkUserId = userId;
		});
	});

	setAccount({
		get isSignedIn() {
			return Boolean(clerkUserId);
		},
		get isReady() {
			return Boolean(clerkUserId) && clerkUserId === syncedClerkUserId;
		}
	});
</script>

{@render children()}
