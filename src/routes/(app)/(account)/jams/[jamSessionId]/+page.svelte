<script lang="ts">
	import { page } from '$app/state';
	import { useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import Maximize from '@lucide/svelte/icons/maximize-2';
	import Radio from '@lucide/svelte/icons/radio';
	import { api } from '#convex/_generated/api.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import AddSongDialog from '#lib/components/jam/add-song-dialog.svelte';
	import ConnectedCount from '#lib/components/jam/connected-count.svelte';
	import FocusStage from '#lib/components/jam/focus-stage.svelte';
	import SessionQr from '#lib/components/jam/session-qr.svelte';
	import SessionSettings from '#lib/components/jam/session-settings.svelte';
	import Setlist from '#lib/components/jam/setlist.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const client = useConvexClient();
	const console_ = $derived(
		await convexQuery(api.jam_session.get, { jamSessionId: params.jamSessionId })
	);
	const liveUrl = $derived(`${page.url.origin}/live/${params.jamSessionId}`);

	async function setLive(isLive: boolean) {
		try {
			await client.mutation(api.jam_session.setLive, {
				jamSessionId: console_!.session._id,
				isLive
			});
		} catch (error) {
			toast.error(
				error instanceof ConvexError && error.data === 'SUBSCRIPTION_REQUIRED'
					? 'Going live needs a subscription. See your account page.'
					: 'Couldn’t change the session. Try again.'
			);
		}
	}

	async function copyLink() {
		await navigator.clipboard.writeText(liveUrl);
		toast.success('Link copied');
	}
</script>

<svelte:head>
	<title>{console_?.session.name ?? 'Session not found'} · Link Up Lyrics</title>
</svelte:head>

{#if !console_}
	<div class="flex flex-col items-center gap-4 pt-10 text-center">
		<h1 class="page-title">Session not found</h1>
		<p class="text-muted-foreground">It may have been deleted, or you’re not a leader in it.</p>
		<Button href="/jams" variant="secondary" class="rounded-xl">Back to your jams</Button>
	</div>
{:else}
	{@const { session, items, roleTag } = console_}
	<a
		href="/jams"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Jams
	</a>

	<header class="mt-3 flex flex-col gap-4">
		<div class="flex items-start gap-2">
			<h1
				class="min-w-0 flex-1 text-3xl font-[750] tracking-tight [text-shadow:0_0_2rem_var(--glow)] sm:text-4xl"
			>
				{session.name}
			</h1>
			{#if roleTag === 'owner'}<SessionSettings {session} />{/if}
		</div>

		<div
			class="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-card px-4 py-3 shadow-sm shadow-black/10"
		>
			{#if session.isLive}
				<span class="flex items-center gap-2 font-semibold text-primary" in:fade>
					<span class="relative flex size-2.5">
						<span class="absolute inset-0 animate-ping rounded-full bg-primary/70"></span>
						<span class="size-2.5 rounded-full bg-primary"></span>
					</span>
					Live
				</span>
			{:else}
				<span class="flex items-center gap-2 font-semibold text-muted-foreground" in:fade>
					<span class="size-2.5 rounded-full bg-muted-foreground/40"></span>
					Not live
				</span>
			{/if}
			<div class="flex-1">
				<ConnectedCount jamSessionId={session._id} />
			</div>
			<Button
				variant={session.isLive ? 'secondary' : 'default'}
				class="w-28 rounded-xl"
				onclick={() => setLive(!session.isLive)}
			>
				{#if session.isLive}End{:else}<Radio /> Go live{/if}
			</Button>
		</div>
	</header>

	<div class="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
		<FocusStage {session} {items} />

		<aside class="flex flex-col gap-6 lg:sticky lg:top-24">
			<section class="flex flex-col gap-3 rounded-3xl bg-card p-3 shadow-sm shadow-black/10">
				<div class="flex items-center justify-between gap-2 pl-2">
					<h2 class="font-semibold">Setlist</h2>
					<AddSongDialog
						jamSessionId={session._id}
						songIdsInSetlist={items.map((item) => item.song._id)}
					/>
				</div>
				<Setlist {session} {items} />
			</section>

			<section
				class="flex flex-col items-center gap-3 rounded-3xl bg-card p-4 shadow-sm shadow-black/10"
			>
				<h2 class="self-start pl-1 font-semibold">Scan to follow along</h2>
				<SessionQr url={liveUrl} class="w-full max-w-72" />
				<p class="w-full truncate text-center font-chart text-xs text-muted-foreground">
					{liveUrl}
				</p>
				<div class="grid w-full grid-cols-2 gap-2">
					<Button variant="secondary" class="rounded-xl" onclick={copyLink}>
						<Copy /> Copy link
					</Button>
					<Button
						variant="secondary"
						class="rounded-xl"
						href="/jams/{session._id}/present"
						target="_blank"
					>
						<Maximize /> Full screen
					</Button>
				</div>
			</section>
		</aside>
	</div>
{/if}
