<script lang="ts">
	import { page } from '$app/state';
	import { settled } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Presentation from '@lucide/svelte/icons/presentation';
	import Radio from '@lucide/svelte/icons/radio';
	import { api } from '#convex/_generated/api.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { appear } from '#lib/motion.js';
	import AddSongDialog from '#lib/components/jam/add-song-dialog.svelte';
	import ConnectedCount from '#lib/components/jam/connected-count.svelte';
	import FocusStage from '#lib/components/jam/focus-stage.svelte';
	import SessionQr from '#lib/components/jam/session-qr.svelte';
	import SessionSettings from '#lib/components/jam/session-settings.svelte';
	import Setlist from '#lib/components/jam/setlist.svelte';
	import BandPanel from '#lib/components/band/band-panel.svelte';
	import HostingStatus from '#lib/components/billing/hosting-status.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const client = useConvexClient();
	const console_ = $derived(
		await convexQuery(api.jam_session.get, { jamSessionId: params.jamSessionId })
	);
	const liveUrl = $derived(`${page.url.origin}/live/${params.jamSessionId}`);

	/** While Go live / End live is on its way, so the button says so and can't be pressed twice. */
	let settingLive = $state(false);

	async function setLive(isLive: boolean) {
		if (
			!isLive &&
			!(await confirmation({
				title: 'End live for everyone?',
				message: 'Phones following along will show that the session ended.',
				confirmLabel: 'End live'
			}))
		)
			return;
		settingLive = true;
		try {
			await client.mutation(api.jam_session.setLive, {
				jamSessionId: console_!.session._id,
				isLive
			});
			await settled(); // until the console shows the new state, so the button never flips back for a frame
		} catch (error) {
			toast.error(errorMessage(error, 'Couldn’t change the session. Try again.'));
		} finally {
			settingLive = false;
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
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10"
	>
		<ArrowLeft class="size-4" /> Jams
	</a>

	<header class="mt-3 flex items-start gap-2">
		<h1
			class="min-w-0 flex-1 text-3xl font-[750] tracking-tight [text-shadow:0_0_2rem_var(--glow)] sm:text-4xl"
		>
			{session.name}
		</h1>
		{#if roleTag === 'owner'}<SessionSettings {session} />{/if}
	</header>

	<!-- Stays in view under the app header while the leader steps through a song: are we live, and who's here. -->
	<div
		class="sticky-under-header z-20 mt-4 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-md shadow-black/15 sm:gap-5"
	>
		{#if session.isLive}
			<span class="flex min-w-[4.75rem] items-center gap-2 font-semibold text-live" in:appear>
				<span class="relative flex size-2.5">
					<span class="absolute inset-0 rounded-full bg-live/70 motion-safe:animate-ping"></span>
					<span class="size-2.5 rounded-full bg-live"></span>
				</span>
				Live
			</span>
		{:else}
			<span
				class="flex min-w-[4.75rem] items-center gap-2 font-semibold text-muted-foreground"
				in:appear
			>
				<span class="size-2.5 rounded-full border-2 border-muted-foreground"></span>
				Not live
			</span>
		{/if}
		<ConnectedCount jamSessionId={session._id} isLive={session.isLive} class="min-w-0 flex-1" />
		<Button
			variant={session.isLive ? 'secondary' : 'default'}
			class="w-[7.5rem] rounded-xl"
			disabled={settingLive}
			onclick={() => setLive(!session.isLive)}
		>
			{#if settingLive}
				<LoaderCircle class="motion-safe:animate-spin" />
				{session.isLive ? 'Ending…' : 'Going live…'}
			{:else if session.isLive}
				End live
			{:else}
				<Radio /> Go live
			{/if}
		</Button>
	</div>
	{#if roleTag === 'owner'}
		<!-- Only when hosting needs the owner (a card that didn't go through, a plan that ended); the Account page
		     has the rest. -->
		<HostingStatus class="mt-3 w-full" />
	{/if}

	<div class="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
		<FocusStage {session} {items} />

		<!-- Pinned beside the song, and scrolls on its own when taller than the screen, so the setlist at its top
		     stays in view however far down the song the leader goes. No taller than the screen less its top and the
		     page's foot (the 11rem under the grid), so reaching the end of the page never pushes it up under the
		     Live bar. The padding keeps the cards' shadows. -->
		<aside
			class="column flex flex-col gap-6 lg:sticky lg:top-[9.5rem] lg:-mx-2 lg:max-h-[calc(100dvh-20.5rem)] lg:[scrollbar-width:thin] lg:overflow-y-auto lg:px-2 lg:pb-2"
		>
			<!-- Below lg the setlist is a sheet from the Prev/Next bar, so the leader never scrolls past the song. -->
			<section
				class="flex flex-col gap-3 rounded-3xl bg-card p-3 shadow-sm shadow-black/10 max-lg:hidden"
			>
				<div class="flex items-center justify-between gap-2 pl-2">
					<h2 class="font-semibold">Setlist</h2>
					<AddSongDialog
						jamSessionId={session._id}
						songIdsInSetlist={items.map((item) => item.song._id)}
					/>
				</div>
				<Setlist {session} {items} />
			</section>

			<BandPanel jamSessionId={session._id} />

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
						title="The QR code full screen, for a projector or TV. Opens in a new tab."
					>
						<Presentation /> Present
					</Button>
				</div>
			</section>
		</aside>
	</div>
{/if}

<style>
	/*
	 * A card the column cuts off fades out at that edge, so it reads as more to scroll to rather than broken.
	 * Scroll-driven, like the editor's long lines: no fade when everything fits, and none at an end it's scrolled to.
	 */
	@property --fade-top {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@property --fade-bottom {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@media (width >= 64rem) {
		.column {
			mask-image: linear-gradient(
				transparent,
				#000 var(--fade-top),
				#000 calc(100% - var(--fade-bottom)),
				transparent
			);
			animation: column-fade linear both;
			animation-timeline: scroll(self);
		}
	}
	@keyframes column-fade {
		0% {
			--fade-top: 0px;
			--fade-bottom: 3rem;
		}
		10%,
		90% {
			--fade-top: 3rem;
			--fade-bottom: 3rem;
		}
		100% {
			--fade-top: 3rem;
			--fade-bottom: 0px;
		}
	}
</style>
