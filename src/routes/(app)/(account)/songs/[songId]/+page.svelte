<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { useConvexClient } from 'convex-svelte';
	import Trash from '@lucide/svelte/icons/trash-2';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { api } from '#convex/_generated/api.js';
	import { constantByTag } from '#convex/constants.js';
	import { keySpelling } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
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

	const client = useConvexClient();
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

	function toggleEditing() {
		void goto(editing ? page.url.pathname : `${page.url.pathname}?edit`, {
			replace: true,
			reset: false
		});
	}
	const spelling = $derived(keySpelling(arrangement?.song.originalKeyTag, semitones));

	async function deleteSong(songId: NonNullable<typeof arrangement>['song']['_id'], title: string) {
		const confirmed = await confirmation({
			title: 'Delete song',
			message: `“${title}” and all its blocks will be deleted. Setlists that use it will lose it.`
		});
		if (!confirmed) return;
		await client.mutation(api.song.remove, { songId });
		await goto('/library');
	}
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
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 flex flex-col items-center gap-2 text-center">
		<h1 class="page-title">{song.title}</h1>
		{#if song.artist}
			<p class="text-lg text-muted-foreground">{song.artist}</p>
		{/if}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-3">
			{#if !editing}
				<TransposeControl bind:semitones keyTag={song.originalKeyTag} />
			{/if}
			{#if song.capo}
				<span class="rounded-xl bg-card px-3 py-2 text-sm">Capo {song.capo}</span>
			{/if}
			{#if arrangement.canEdit}
				<Button
					variant={editing ? 'default' : 'secondary'}
					class="rounded-xl"
					onclick={toggleEditing}
				>
					{#if editing}<Check /> Done{:else}<Pencil /> Edit{/if}
				</Button>
				{#if editing}
					<SongDetailsDialog {song} />
				{/if}
				<Button
					variant="ghost"
					size="icon"
					class="rounded-xl text-muted-foreground hover:text-destructive"
					aria-label="Delete song"
					onclick={() => deleteSong(song._id, song.title)}
				>
					<Trash />
				</Button>
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
		<article class="mt-10 rounded-2xl bg-card/60 p-5 sm:p-8">
			{#if arrangement.blocks.length}
				<SongChart blocks={arrangement.blocks} {semitones} {spelling} />
			{:else}
				<p class="text-center text-muted-foreground">This song has no words yet.</p>
			{/if}
		</article>
	{/if}

	<footer class="mt-6 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
		<span>{constantByTag('CopyrightSources', song.copyrightSourceTag).name}</span>
		<SongCredits
			copyrightLine={song.copyrightLine}
			ccliSongNumber={song.ccliSongNumber}
			ccliLicenseNumber={arrangement.ccliLicenseNumber}
		/>
	</footer>
{/if}
