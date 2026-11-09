<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { setupConvex } from 'convex-svelte';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$app/env/public';
	import { setConvexQueryCache } from '#lib/convex-query.svelte.js';
	import ConvexClerkSetup from '#lib/components/convex-clerk-setup.svelte';
	import ConfirmationDialog from '#lib/components/confirmation-dialog.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	setupConvex(PUBLIC_CONVEX_URL);
	// Not boilerplate: dedupes convexQuery subscriptions across components (plan §11).
	setConvexQueryCache(new Map());
</script>

<svelte:head>
	<title>Link Up Lyrics</title>
	<meta
		name="description"
		content="Shared chord charts for small groups. One QR code, everyone on the same song."
	/>
</svelte:head>

<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY}>
	<ConvexClerkSetup
		isAuthenticated={Boolean(data.clerkUserId)}
		serverToken={data.convexToken}
		serverClerkUserId={data.clerkUserId}
	>
		{@render children()}
	</ConvexClerkSetup>
</ClerkProvider>

<!-- Dark first: rooms are dim and phones shouldn't glare. -->
<ModeWatcher defaultMode="dark" themeColors={{ dark: '#3d210d', light: '#f8f1e9' }} />
<ConfirmationDialog />
<Toaster position="top-center" />
