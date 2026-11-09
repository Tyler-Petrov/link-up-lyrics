<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { api } from '#convex/_generated/api.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import SessionQr from '#lib/components/jam/session-qr.svelte';
	import type { PageProps } from './$types';

	/*
	 * The QR, as big as the screen allows, for a projector or a propped-up tablet. It shows nothing the QR
	 * itself doesn't (the session name and the current song, from the public live query), so it needs no
	 * sign-in. Outside the app layout: no header, dark always.
	 */
	let { params }: PageProps = $props();
	const liveUrl = $derived(`${page.url.origin}/live/${params.jamSessionId}`);
</script>

<svelte:head>
	<title>Scan to follow along · Link Up Lyrics</title>
</svelte:head>

<div
	class="dark stage grid min-h-dvh place-items-center bg-background p-[4vmin] text-foreground [color-scheme:dark]"
>
	<svelte:boundary pending={browser ? pending : undefined}>
		{@const live = await convexQuery(api.live.watch, { jamSessionId: params.jamSessionId })}
		<main class="flex flex-col items-center gap-[3vmin] text-center">
			{#if live.state !== 'notFound'}
				<h1
					class="text-[min(6vmin,3.5rem)] font-[750] tracking-tight [text-shadow:0_0_2rem_var(--glow)]"
				>
					{live.name}
				</h1>
			{/if}
			<!-- Black on white, the way phone cameras across a room read best. -->
			<SessionQr
				url={liveUrl}
				class="w-[min(70vmin,40rem)] rounded-[3vmin] bg-white text-black shadow-none"
			/>
			<p class="text-[min(3vmin,1.5rem)] text-muted-foreground">
				Scan to follow along. No app or account needed.
			</p>
			<p
				class={[
					'h-[min(3.2vmin,1.6rem)] text-[min(3vmin,1.5rem)] font-semibold',
					live.state === 'live' ? 'text-primary' : 'text-muted-foreground'
				]}
			>
				{#if live.state === 'live'}Now: {live.song.title}{:else if live.state === 'offline'}Starting
					soon{/if}
			</p>
		</main>
	</svelte:boundary>

	{#snippet pending()}
		<span class="size-3 animate-pulse rounded-full bg-muted-foreground"></span>
	{/snippet}
</div>
