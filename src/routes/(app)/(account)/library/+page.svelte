<script lang="ts">
	import { Debounced } from 'runed';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import { api } from '#convex/_generated/api.js';
	import { keyName } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { appear, glide } from '#lib/motion.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import PasteSongDialog from '#lib/components/paste-song-dialog.svelte';

	let search = $state('');
	const debouncedSearch = new Debounced(() => search.trim(), 250);
	const listing = $derived(
		convexQuery(
			api.song.listMine,
			debouncedSearch.current ? { search: debouncedSearch.current } : {}
		)
	);
	const songs = $derived(await listing);
	/** Waiting on the debounce or on the results; the old list stays up meanwhile. */
	const searching = $derived(search.trim() !== debouncedSearch.current || listing.isLoading);
	const edited = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
</script>

<svelte:head>
	<title>Library · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Your Library</h1>

<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
	<div class="relative flex-1">
		<!-- The icon turns into a spinner only if a search takes a moment, so quick ones don't flicker. -->
		<Search
			class={[
				'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-opacity',
				searching && 'opacity-0 delay-150'
			]}
		/>
		<LoaderCircle
			class={[
				'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground transition-opacity',
				searching ? 'delay-150' : 'opacity-0'
			]}
			aria-hidden="true"
		/>
		<Input
			bind:value={search}
			placeholder="Search by title"
			aria-label="Search your songs by title"
			class="h-10 rounded-xl pl-9"
			type="search"
		/>
	</div>
	<PasteSongDialog />
</div>

<ul class="mt-6 flex flex-col gap-2" aria-busy={searching}>
	{#each songs as song (song._id)}
		<li animate:glide transition:appear>
			<a
				href="/songs/{song._id}"
				class="flex items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-sm shadow-black/10 transition-colors hover:bg-accent"
			>
				<div class="min-w-0 flex-1">
					<p class="truncate font-semibold">{song.title}</p>
					<p class="truncate text-sm text-muted-foreground">
						{song.artist ?? 'Unknown artist'}
					</p>
				</div>
				{#if song.originalKeyTag}
					<span class="rounded-lg bg-accent px-2 py-1 font-chart text-sm"
						>{keyName(song.originalKeyTag)}</span
					>
				{/if}
				<span class="hidden text-xs text-muted-foreground sm:inline"
					>Edited {edited.format(song.updatedEpoch)}</span
				>
			</a>
		</li>
	{:else}
		<li
			class="flex flex-col items-center gap-3 rounded-2xl bg-card/60 p-10 text-center text-muted-foreground"
			in:appear
		>
			{#if debouncedSearch.current}
				No titles match “{debouncedSearch.current}”.
				<button
					type="button"
					class="rounded-xl bg-secondary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
					onclick={() => (search = '')}
				>
					Clear search
				</button>
			{:else}
				No songs yet. Paste one in to get started.
			{/if}
		</li>
	{/each}
</ul>
