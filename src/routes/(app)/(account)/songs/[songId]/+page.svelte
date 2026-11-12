<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { api } from '#convex/_generated/api.js';
	import { constantByTag } from '#convex/constants.js';
	import { keySpelling } from '#convex/shared/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { reduced } from '#lib/motion.js';
	import SongChart from '#lib/components/chart/song-chart.svelte';
	import TransposeControl from '#lib/components/chart/transpose-control.svelte';
	import SongCredits from '#lib/components/chart/song-credits.svelte';
	import SongEditor from '#lib/components/editor/song-editor.svelte';
	import SongDetailsDialog from '#lib/components/editor/song-details-dialog.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const arrangement = $derived(
		await convexQuery(api.song.getArrangement, { songId: params.songId })
	);
	/* Per song: navigating song → song starts over at the original key. */
	let semitones = $derived.by(() => {
		void params.songId;
		return 0;
	});
	/** The owner's edit mode, in the URL (`?edit`) so a reload keeps it; everyone else only sees the chart. */
	const editing = $derived(!!arrangement?.canEdit && page.url.searchParams.has('edit'));

	/**
	 * While Edit and Done crossfade, the button is named so it slides to its new place in the row. Only then: a
	 * name left on would also lift it out of the crossfade from the library and float it over the old page.
	 */
	let toggling = $state(false);

	/** Chart and editor crossfade as one change of the page (the layout's page transitions skip `?edit`). */
	function toggleEditing() {
		const go = () =>
			goto(editing ? page.url.pathname : `${page.url.pathname}?edit`, {
				replace: true,
				reset: false
			});
		if (reduced() || !document.startViewTransition) return void go();
		toggling = true;
		const transition = document.startViewTransition(async () => {
			await go();
			await tick();
		});
		transition.ready.catch(() => undefined);
		transition.finished.finally(() => (toggling = false));
	}
	const spelling = $derived(keySpelling(arrangement?.song.originalKeyTag, semitones));
</script>

<svelte:head>
	<title>{arrangement?.song.title ?? 'Song not found'} · Link Up Lyrics</title>
</svelte:head>

{#if !arrangement}
	<div class="flex flex-col items-center gap-4 pt-10 text-center">
		<h1 class="page-title">Song not found</h1>
		<p class="text-muted-foreground">It may have been deleted, or it isn’t shared with you.</p>
		<Button href="/library" variant="secondary" class="rounded-xl">Back to your library</Button>
	</div>
{:else}
	{@const song = arrangement.song}
	<a
		href="/library"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 flex flex-col items-center gap-2 text-center">
		<h1 class="page-title">{song.title}</h1>
		{#if song.artist}
			<p class="text-lg text-muted-foreground">{song.artist}</p>
		{/if}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-3">
			<!-- All one height (h-10), so swapping the transpose control for Details never moves the row. -->
			{#if !editing}
				<TransposeControl bind:semitones keyTag={song.originalKeyTag} />
			{/if}
			{#if song.capo}
				<span class="inline-flex h-10 items-center rounded-xl bg-card px-3 text-sm"
					>Capo {song.capo}</span
				>
			{/if}
			{#if arrangement.canEdit}
				<Button
					variant={editing ? 'default' : 'secondary'}
					class={['h-10 rounded-xl px-4', toggling && '[view-transition-name:song-edit-toggle]']}
					onclick={toggleEditing}
				>
					{#if editing}<Check /> Done{:else}<Pencil /> Edit{/if}
				</Button>
				{#if editing}
					<SongDetailsDialog {song} />
				{/if}
			{/if}
		</div>
	</header>

	{#if editing}
		<div class="mt-10">
			{#key params.songId}
				<SongEditor routeSongId={params.songId} {arrangement} />
			{/key}
		</div>
	{:else}
		<article class="mt-10 rounded-2xl bg-card p-5 shadow-sm shadow-black/10 sm:p-8">
			{#if arrangement.blocks.length}
				<SongChart blocks={arrangement.blocks} {semitones} {spelling} />
			{:else}
				<p class="text-center text-muted-foreground">This song has no words yet.</p>
			{/if}
		</article>
	{/if}

	<footer class="mt-6 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
		<!-- "Not Specified" would only read like an error to the room, and a copyright line says it in full. -->
		{#if song.copyrightSourceTag !== 'unknown' && !song.copyrightLine}
			<span>{constantByTag('CopyrightSources', song.copyrightSourceTag).name}</span>
		{/if}
		<SongCredits
			copyrightLine={song.copyrightLine}
			ccliSongNumber={song.ccliSongNumber}
			ccliLicenseNumber={arrangement.ccliLicenseNumber}
		/>
	</footer>
{/if}
