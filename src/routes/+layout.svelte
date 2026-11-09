<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { setupConvex } from 'convex-svelte';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$app/env/public';
	import { setConvexQueryCache } from '#lib/convex-query.svelte.js';
	import ConvexClerkSetup from '#lib/components/convex-clerk-setup.svelte';
	import ConfirmationDialog from '#lib/components/confirmation-dialog.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { ThemeColors } from '#lib/theme-colors.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	setupConvex(PUBLIC_CONVEX_URL);
	// Not boilerplate: dedupes convexQuery subscriptions across components (plan §11).
	setConvexQueryCache(new Map());

	/*
	 * The browser chrome's colour: the page's background, and the near-black .stage on /live and the projector
	 * view whatever the mode. Until the mode is known (the server render), mode-watcher picks from the pair before
	 * paint; after that it renders the pair's .dark, so it gets the one right colour.
	 */
	const themeColors = $derived.by(() => {
		const isStage =
			page.route.id?.startsWith('/live/') || page.route.id === '/jams/[jamSessionId]/present';
		const color = isStage ? ThemeColors.stage : mode.current && ThemeColors[mode.current];
		return color ? { light: color, dark: color } : ThemeColors;
	});
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
<ModeWatcher defaultMode="dark" {themeColors} />
<ConfirmationDialog />
<Toaster position="top-center" />
