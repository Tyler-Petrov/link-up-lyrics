<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { on } from 'svelte/events';
	import { MediaQuery } from 'svelte/reactivity';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { setupConvex } from 'convex-svelte';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$app/env/public';
	import { api } from '#convex/_generated/api.js';
	import { createWatchedWebSocket } from '#lib/connection.svelte.js';
	import { setConvexQueryCache } from '#lib/convex-query.svelte.js';
	import { noteOutdatedPageError, outdatedPageNeedsReload } from '#lib/outdated-page.svelte.js';
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
	 * Outdated pages reload themselves. The deploy workflow records each release once it's live
	 * (client_reload.ts), so `updated` checks right away instead of at its next poll. A page that hits an error
	 * from before the release (a Convex function it calls is gone, a code file it loads was replaced) reloads once
	 * the new version is live, and a tab someone comes back to reloads if a release went out meanwhile.
	 */
	$effect(() => {
		let seen: number | null | undefined;
		return client.onUpdate(api.client_reload.latestRelease, {}, (latest) => {
			if (seen !== undefined && latest !== seen) void updated.check();
			seen = latest;
		});
	});
	$effect(() =>
		on(window, 'unhandledrejection', ({ reason }) => void noteOutdatedPageError(reason))
	);
	$effect(() => {
		if (outdatedPageNeedsReload()) location.reload();
	});
	async function reloadOutdatedReturningTab() {
		if (!document.hidden && (await updated.check())) location.reload();
	}

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
		},
		elements: {
			// One surface: Clerk's footer is a lighter band under a rounded card, which reads as a seam. The outer
			// box keeps the rounding. The same for the account menu.
			card: { boxShadow: 'none', borderRadius: 0 },
			footer: { background: 'var(--card)' },
			userButtonPopoverMain: { boxShadow: 'none', borderRadius: 0 },
			userButtonPopoverFooter: { background: 'var(--card)' },
			// "Continue with Google" is the sign-in's one action, so it looks like the app's secondary button.
			socialButtonsBlockButton: {
				minHeight: '2.5rem',
				background: 'var(--secondary)',
				color: 'var(--secondary-foreground)',
				'&:hover': { background: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)' }
			},
			socialButtonsBlockButtonText: { color: 'inherit' }
		}
	};
	// Clerk's menu item opens its sign-in and profile settings; the header's Account item is the app's page.
	const clerkLocalization = { userButton: { action__manageAccount: 'Sign-in & profile' } };

	/*
	 * Toasts: on phones under the floating header; on wide screens at the bottom right, clear of what a leader
	 * watches (the console's status card under the header, its Prev/Next bar at the bottom of the song).
	 */
	const wide = new MediaQuery('min-width: 64rem');
</script>

<svelte:document onvisibilitychange={reloadOutdatedReturningTab} />

<svelte:head>
	<title>Link Up Lyrics</title>
	<meta
		name="description"
		content="Shared chord charts for small groups. One QR code, everyone on the same song."
	/>
</svelte:head>

<ClerkProvider
	publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY}
	appearance={clerkAppearance}
	localization={clerkLocalization}
>
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
<Toaster
	position={wide.current ? 'bottom-right' : 'top-center'}
	offset={{ top: 'calc(var(--header-bottom) + 1rem)' }}
	mobileOffset={{ top: 'calc(var(--header-bottom) + 0.75rem)' }}
/>
