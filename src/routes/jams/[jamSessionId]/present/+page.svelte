<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { api } from '#convex/_generated/api.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { appear } from '#lib/motion.js';
	import SessionQr from '#lib/components/jam/session-qr.svelte';
	import type { PageProps } from './$types';

	/*
	 * The QR, as big as the screen allows, for a projector or a propped-up tablet. It shows nothing the QR
	 * itself doesn't (the session name and the current song, from the public live query), so it needs no
	 * sign-in. Outside the app layout: no header, dark always. A click or key press goes full screen.
	 */
	let { params }: PageProps = $props();
	const liveUrl = $derived(`${page.url.origin}/live/${params.jamSessionId}`);

	let fullscreen = $state(false);
	const goFullscreen = () => {
		if (!document.fullscreenElement)
			void document.documentElement.requestFullscreen?.().catch(() => {});
	};
</script>

<svelte:head>
	<title>Scan to follow along · Link Up Lyrics</title>
</svelte:head>

<svelte:window onclick={goFullscreen} onkeydown={goFullscreen} />
<svelte:document onfullscreenchange={() => (fullscreen = !!document.fullscreenElement)} />

<div
	class="dark stage grid min-h-dvh place-items-center bg-background p-[4vmin] text-foreground [color-scheme:dark]"
>
	<svelte:boundary pending={browser ? pending : undefined}>
		{@const live = await convexQuery(api.live.watch, { jamSessionId: params.jamSessionId })}
		{#if live.state === 'notFound'}
			<main class="flex flex-col items-center gap-[2vmin] text-center">
				<h1 class="text-[min(5vmin,3rem)] font-bold">This session doesn’t exist</h1>
				<p class="text-[min(3vmin,1.5rem)] text-muted-foreground">
					Check the link in the session’s console.
				</p>
			</main>
		{:else}
			<main class="flex max-w-full flex-col items-center gap-[3vmin] text-center">
				<h1
					class="max-w-full truncate text-[min(6vmin,3.5rem)] font-[750] tracking-tight [text-shadow:0_0_2rem_var(--glow)]"
				>
					{live.name}
				</h1>
				<!-- Black on white, the way phone cameras across a room read best. Sized from the height left too, so
				     the lines under it stay on a 16:10 screen. -->
				<SessionQr
					url={liveUrl}
					class="w-[min(70vmin,40rem,calc(100dvh-40vmin))] rounded-[3vmin] bg-white text-black shadow-none"
				/>
				<p class="text-[min(3vmin,1.5rem)] text-muted-foreground">
					Scan to follow along. No app or account needed.
				</p>
				<p
					class={[
						'grid h-[min(3.2vmin,1.6rem)] text-[min(3vmin,1.5rem)] font-semibold *:col-start-1 *:row-start-1',
						live.state === 'live' ? 'text-primary' : 'text-muted-foreground'
					]}
				>
					{#key live.state === 'live' ? live.song.title : live.state}
						<span in:appear>
							{#if live.state === 'live'}Now: {live.song
									.title}{:else if live.state === 'offline'}Starting soon{/if}
						</span>
					{/key}
				</p>
			</main>
		{/if}
	</svelte:boundary>

	{#if !fullscreen}
		<p
			class="pointer-events-none fixed inset-x-0 bottom-[1.5vmin] text-center text-[min(1.8vmin,0.875rem)] text-muted-foreground/50"
			{@attach (hint) => {
				hint.hidden = !document.fullscreenEnabled; // e.g. iPhone
			}}
			transition:appear
		>
			Click anywhere for full screen
		</p>
	{/if}

	{#snippet pending()}
		<span class="size-3 rounded-full bg-muted-foreground motion-safe:animate-pulse"></span>
	{/snippet}
</div>
