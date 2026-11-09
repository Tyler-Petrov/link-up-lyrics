<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { useConvexClient } from 'convex-svelte';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { groupArrangement, keySpelling } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import LivePresence from '#lib/components/live/live-presence.svelte';
	import LiveSettings from '#lib/components/live/live-settings.svelte';
	import LiveStage from '#lib/components/live/live-stage.svelte';
	import { createViewerSettings } from '#lib/components/live/viewer-settings.svelte.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const client = useConvexClient();
	const live = $derived(await convexQuery(api.live.watch, { jamSessionId: params.jamSessionId }));
	const settings = createViewerSettings();

	const isLive = $derived(live.state === 'live');
	const focusedItemId = $derived(live.state === 'live' ? live.focusedItemId : undefined);
	const title = $derived(live.state === 'live' ? live.song.title : undefined);
	const groupCount = $derived(live.state === 'live' ? groupArrangement(live.blocks).length : 0);

	/* "Now: <title>" for a few seconds when the leader moves to another song (not on first load). */
	let nowTitle = $state<string>();
	let shownItemId: string | undefined;
	let nowTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (!focusedItemId || focusedItemId === shownItemId) return;
		const isFirst = shownItemId === undefined;
		shownItemId = focusedItemId;
		if (isFirst) return;
		nowTitle = title;
		clearTimeout(nowTimer);
		nowTimer = setTimeout(() => (nowTitle = undefined), 3500);
	});

	/* On a dropped socket the last words stay up behind a chip; Convex resubscribes by itself. */
	let reconnecting = $state(false);
	$effect(() =>
		client.subscribeToConnectionState((state) => {
			reconnecting = state.hasEverConnected && !state.isWebSocketConnected;
		})
	);

	/* Keep the screen on while live; the browser drops the lock whenever the tab hides, so take it back. */
	$effect(() => {
		if (!isLive || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | undefined;
		const acquire = async () => {
			if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
			lock = await navigator.wakeLock.request('screen').catch(() => undefined);
		};
		void acquire();
		document.addEventListener('visibilitychange', acquire);
		return () => {
			document.removeEventListener('visibilitychange', acquire);
			void lock?.release();
		};
	});
</script>

<svelte:head>
	<title>{live.state === 'notFound' ? 'Not found' : live.name} · Link Up Lyrics</title>
	<meta name="theme-color" content="#3d210d" />
</svelte:head>

{#if live.state !== 'notFound'}
	<LivePresence jamSessionId={params.jamSessionId as Id<'JamSession'>} />
{/if}

<div class="flex min-h-dvh flex-col">
	<!-- Fixed height, so chips coming and going never move the words. -->
	<header
		class="sticky top-0 z-20 flex h-16 items-center gap-3 bg-gradient-to-b from-background from-60% to-transparent px-4 pt-[env(safe-area-inset-top)]"
	>
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs text-muted-foreground">
				{live.state === 'notFound' ? 'Link Up Lyrics' : live.name}
			</p>
			<p class="truncate font-semibold">
				{#if live.state === 'live'}{live.song.title}{:else}&nbsp;{/if}
			</p>
		</div>
		{#if reconnecting}
			<span
				class="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground"
				transition:fade={{ duration: 150 }}
			>
				<WifiOff class="size-3.5" /> Reconnecting
			</span>
		{/if}
		{#if live.state === 'live'}
			<LiveSettings {settings} />
		{/if}
	</header>

	{#if nowTitle}
		<div class="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
			<p
				class="max-w-full truncate rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/30"
				in:fly={{ y: -12, duration: 250 }}
				out:fade={{ duration: 300 }}
			>
				Now: {nowTitle}
			</p>
		</div>
	{/if}

	{#if live.state === 'live'}
		<main
			class={[
				'flex flex-1 flex-col px-5 pb-16',
				settings.mode === 'song' ? 'pt-4' : 'justify-center py-10'
			]}
		>
			<LiveStage
				blocks={live.blocks}
				focusedGroupIndex={live.focusedGroupIndex}
				focusedEpoch={live.focusedEpoch}
				showChords={live.isPlayer}
				semitones={live.transposeSemitones}
				spelling={keySpelling(live.song.originalKeyTag, live.transposeSemitones)}
				{settings}
			/>
		</main>

		<!-- Where we are in the song: one segment per group, the current one lit. -->
		<footer
			class="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-40% to-transparent px-6 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
			aria-label="Group {Math.min(live.focusedGroupIndex, groupCount - 1) + 1} of {groupCount}"
		>
			<div class="mx-auto flex max-w-md gap-1">
				{#each { length: groupCount }, index (index)}
					<span
						class={[
							'h-1.5 flex-1 rounded-full transition-colors duration-500',
							index === live.focusedGroupIndex
								? 'bg-primary shadow-[0_0_10px_var(--color-primary)]'
								: index < live.focusedGroupIndex
									? 'bg-primary/40'
									: 'bg-muted-foreground/15'
						]}
					></span>
				{/each}
			</div>
		</footer>
	{:else}
		<main class="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-24 text-center">
			{#if live.state === 'notFound'}
				<h1 class="text-2xl font-bold">This session doesn’t exist</h1>
				<p class="max-w-xs text-muted-foreground">
					Check the QR code, or ask whoever’s leading for the link.
				</p>
			{:else}
				<span class="relative grid size-16 place-items-center" aria-hidden="true">
					<span
						class="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s]"
					></span>
					<span class="size-4 rounded-full bg-primary/80"></span>
				</span>
				<h1 class="text-2xl font-bold">
					{live.state === 'offline' ? 'Not live yet' : 'Picking a song…'}
				</h1>
				<p class="max-w-xs text-muted-foreground">
					{live.state === 'offline'
						? 'Keep this page open. The words appear here as soon as the leader starts.'
						: 'The words appear here as soon as the leader picks one.'}
				</p>
			{/if}
		</main>
	{/if}
</div>
