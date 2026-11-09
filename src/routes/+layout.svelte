<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { setupConvex } from 'convex-svelte';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$app/env/public';
	import { api } from '#convex/_generated/api.js';
	import { createWatchedWebSocket } from '#lib/connection.svelte.js';
	import { setConvexQueryCache } from '#lib/convex-query.svelte.js';
	import { reduced } from '#lib/motion.js';
	import ConvexClerkSetup from '#lib/components/convex-clerk-setup.svelte';
	import ConfirmationDialog from '#lib/components/confirmation-dialog.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { ThemeColors } from '#lib/theme-colors.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const client = setupConvex(PUBLIC_CONVEX_URL, {
		// Notices a silently dropped socket (a phone losing signal) in seconds rather than a minute.
		webSocketConstructor: browser
			? createWatchedWebSocket(() =>
					client.query(api.connection.ping, { nonce: Math.random().toString(36) })
				)
			: undefined
	});
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

	/*
	 * Page changes crossfade instead of cutting (the header, named in app.css, holds still). Not for query-only
	 * changes like ?edit, which stay on the page. The old page is frozen on screen until the new one is ready, so
	 * a slow page drops the crossfade after a moment and the header's progress bar shows instead.
	 */
	onNavigate((navigation) => {
		if (
			reduced() ||
			!document.startViewTransition ||
			document.visibilityState !== 'visible' ||
			navigation.from?.url.pathname === navigation.to?.url.pathname
		)
			return;
		return new Promise((resolveNavigation) => {
			const transition = document.startViewTransition(async () => {
				resolveNavigation();
				// A newer navigation may supersede this one; that shouldn't fail the transition.
				await navigation.complete.catch(() => undefined);
			});
			// Browsers reject `ready` when the animation is skipped, though the navigation went fine.
			transition.ready.catch(() => undefined);
			const skip = setTimeout(() => transition.skipTransition(), 150);
			navigation.complete.finally(() => clearTimeout(skip)).catch(() => undefined);
		});
	});

	/* Clerk's sign-in, menus and modals in the app's palette, radius and type, following light and dark. */
	const clerkAppearance = {
		variables: {
			colorPrimary: 'var(--primary)',
			colorPrimaryForeground: 'var(--primary-foreground)',
			colorBackground: 'var(--card)',
			colorForeground: 'var(--foreground)',
			colorMutedForeground: 'var(--muted-foreground)',
			colorMuted: 'var(--muted)',
			colorNeutral: 'var(--foreground)',
			colorInput: 'var(--background)',
			colorInputForeground: 'var(--foreground)',
			colorBorder: 'var(--border)',
			colorRing: 'var(--ring)',
			colorDanger: 'var(--destructive)',
			colorSuccess: 'var(--success)',
			borderRadius: 'var(--radius)',
			fontFamily: 'inherit'
		}
	};
</script>

<svelte:head>
	<title>Link Up Lyrics</title>
	<meta
		name="description"
		content="Shared chord charts for small groups. One QR code, everyone on the same song."
	/>
</svelte:head>

<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY} appearance={clerkAppearance}>
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
<!-- Below the floating header, so a toast never covers the nav. -->
<Toaster position="top-center" offset={{ top: '4.75rem' }} mobileOffset={{ top: '4.5rem' }} />
