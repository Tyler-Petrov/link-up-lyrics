<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { groupArrangement, keySpelling } from '#lib/chart/index.js';
	import { useConnection } from '#lib/connection.svelte.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { appear, ms } from '#lib/motion.js';
	import LivePresence from '#lib/components/live/live-presence.svelte';
	import LiveSettings from '#lib/components/live/live-settings.svelte';
	import LiveStage from '#lib/components/live/live-stage.svelte';
	import SongCredits from '#lib/components/chart/song-credits.svelte';
	import { createViewerSettings } from '#lib/components/live/viewer-settings.svelte.js';
	import type { PageProps } from './$types';

	let { data, params }: PageProps = $props();

	const live = $derived(await convexQuery(api.live.watch, { jamSessionId: params.jamSessionId }));
	// This phone's choice as the page loads; from then on the settings sheet changes it.
	const settings = createViewerSettings(untrack(() => data.viewer));

	const isLive = $derived(live.state === 'live');
	const groups = $derived(live.state === 'live' ? groupArrangement(live.blocks) : []);
	// The song may have lost groups since the leader focused one.
	const groupIndex = $derived(
		live.state === 'live' ? Math.max(0, Math.min(live.focusedGroupIndex, groups.length - 1)) : 0
	);

	/*
	 * Live at some point on this visit: going offline after that is the end of the jam, not "not live yet", and
	 * so is the leader deleting the session afterwards (not "this session doesn't exist").
	 */
	let wasLive = $state(false);
	$effect(() => {
		if (isLive) wasLive = true;
	});
	const ended = $derived(wasLive && (live.state === 'offline' || live.state === 'notFound'));

	/* On a dropped socket the last words stay up behind a chip; Convex resubscribes by itself. */
	const connection = useConnection();

	/* Keep the screen on while live; the browser drops the lock whenever the tab hides, so take it back. */
	$effect(() => {
		if (!isLive || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | undefined;
		let disposed = false;
		const acquire = async () => {
			if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
			const acquired = await navigator.wakeLock.request('screen').catch(() => undefined);
			// Ended while the request was out: let go instead of holding the screen on.
			if (disposed) void acquired?.release();
			else lock = acquired;
		};
		void acquire();
		document.addEventListener('visibilitychange', acquire);
		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', acquire);
			void lock?.release();
		};
	});
</script>

<svelte:head>
	<title>{live.state === 'notFound' ? 'Not found' : live.name} · Link Up Lyrics</title>
</svelte:head>

{#if live.state !== 'notFound'}
	<LivePresence jamSessionId={params.jamSessionId as Id<'JamSession'>} />
{/if}

<div class="flex min-h-dvh flex-col">
	<!-- Fixed height, so chips coming and going never move the words. Solid behind the titles, and words scrolling
	     up fade out just below it rather than running through them. -->
	<header
		class="sticky top-0 z-20 flex h-16 items-center gap-3 bg-background px-4 pt-[env(safe-area-inset-top)] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-background after:to-transparent"
	>
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs text-muted-foreground">
				{live.state === 'notFound' ? 'Link Up Lyrics' : live.name}
			</p>
			<!-- Hands off with the words below: the old title fades as they do, the new one with the new song's. -->
			<p class="grid grid-cols-1 font-semibold">
				{#key live.state === 'live' ? live.song.title : ''}
					<span
						class="col-start-1 row-start-1 truncate"
						in:fade={{ duration: ms(320), delay: ms(120) }}
						out:fade={{ duration: ms(120) }}
					>
						{#if live.state === 'live'}{live.song.title}{:else}&nbsp;{/if}
					</span>
				{/key}
			</p>
		</div>
		{#if connection.reconnecting}
			<span
				class="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground"
				transition:appear
			>
				<WifiOff class="size-3.5" /> Reconnecting
			</span>
		{/if}
		{#if live.state === 'live'}
			<!-- Arrives and leaves with the words, not a frame ahead of them. -->
			<div transition:appear><LiveSettings {settings} /></div>
		{/if}
	</header>

	<!-- Each state fades in as it arrives: not live yet, picking a song, the words, the end. -->
	{#key ended ? 'ended' : live.state}
		<main
			class={[
				'flex flex-1 flex-col',
				live.state !== 'live'
					? 'items-center justify-center gap-4 px-8 pb-24 text-center'
					: settings.mode === 'song'
						? 'px-5 pt-4 pb-36' // room under the credits for the Jump to current chip
						: 'px-5 pt-[14vh] pb-24' // each group starts where the last did; the credits clear the Now chip
			]}
			in:appear
		>
			{#if live.state === 'live'}
				<LiveStage
					focusedItemId={live.focusedItemId}
					title={live.song.title}
					blocks={live.blocks}
					{groups}
					{groupIndex}
					focusedEpoch={live.focusedEpoch}
					showChords={live.isPlayer}
					semitones={live.transposeSemitones}
					spelling={keySpelling(live.song.originalKeyTag, live.transposeSemitones)}
					{settings}
				/>
				<!-- At the foot of the screen, so a group changing size doesn't move them (one taller than the screen
				     pushes them down, after its words). -->
				<SongCredits
					copyrightLine={live.song.copyrightLine}
					ccliSongNumber={live.song.ccliSongNumber}
					ccliLicenseNumber={live.ccliLicenseNumber}
					class="mt-auto pt-10 opacity-70"
				/>
			{:else if live.state === 'notFound' && !ended}
				<h1 class="text-2xl font-bold">This session doesn’t exist</h1>
				<p class="max-w-xs text-muted-foreground">
					Check the QR code, or ask whoever’s leading for the link.
				</p>
			{:else}
				<span class="relative grid size-16 place-items-center" aria-hidden="true">
					{#if !ended}
						<span
							class="absolute inset-0 rounded-full bg-muted-foreground/15 [animation-duration:2.4s] motion-safe:animate-ping"
						></span>
					{/if}
					<span class="size-4 rounded-full border-2 border-muted-foreground"></span>
				</span>
				<h1 class="text-2xl font-bold">
					{ended
						? 'That’s the end of the session'
						: live.state === 'offline'
							? 'Not live yet'
							: 'Picking a song…'}
				</h1>
				<p class="max-w-xs text-muted-foreground">
					{ended
						? 'Thanks for singing along.'
						: live.state === 'offline'
							? 'Keep this page open. The words appear here as soon as the leader starts.'
							: 'The words appear here as soon as the leader picks one.'}
				</p>
			{/if}
		</main>
	{/key}

	{#if live.state === 'live'}
		<!-- Where we are in the song: one segment per group, the current one lit. -->
		<footer
			class="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-40% to-transparent px-6 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
			aria-label="Group {groupIndex + 1} of {groups.length}"
			transition:appear
		>
			<div class="mx-auto flex max-w-md gap-1">
				{#each groups as group (group.key)}
					<span
						class={[
							'h-1.5 flex-1 rounded-full transition-colors duration-500',
							group.index === groupIndex
								? 'bg-primary shadow-[0_0_10px] shadow-primary/15'
								: group.index < groupIndex
									? 'bg-primary/40'
									: 'bg-muted-foreground/15'
						]}
					></span>
				{/each}
			</div>
		</footer>
	{/if}
</div>
