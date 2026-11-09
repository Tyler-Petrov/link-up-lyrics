<script lang="ts">
	import { Debounced } from 'runed';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { keyName } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	type Props = {
		jamSessionId: Id<'JamSession'>;
		/** Songs already on the setlist, marked so they aren't added twice by accident. */
		songIdsInSetlist: Id<'Song'>[];
	};
	let { jamSessionId, songIdsInSetlist }: Props = $props();

	const client = useConvexClient();
	let open = $state(false);
	let search = $state('');
	const debouncedSearch = new Debounced(() => search.trim(), 250);

	async function add(songId: Id<'Song'>, title: string) {
		await client.mutation(api.jam_session.addSong, { jamSessionId, songId });
		toast.success(`Added “${title}”`);
	}
</script>

<Dialog.Root bind:open>
	<Button variant="secondary" class="rounded-xl" onclick={() => (open = true)}>
		<Plus /> Add songs
	</Button>
	<Dialog.Content class="flex max-h-[min(40rem,90dvh)] flex-col rounded-2xl sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Add songs from your library</Dialog.Title>
			<Dialog.Description>They go to the end of the setlist. Drag to reorder.</Dialog.Description>
		</Dialog.Header>
		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				bind:value={search}
				placeholder="Search your songs"
				class="h-10 rounded-xl pl-9"
				type="search"
			/>
		</div>
		<div class="-mx-2 min-h-48 flex-1 overflow-y-auto px-2">
			<svelte:boundary>
				{@const songs = await convexQuery(
					api.song.listMine,
					debouncedSearch.current ? { search: debouncedSearch.current } : {}
				)}
				<ul class="flex flex-col gap-1">
					{#each songs as song (song._id)}
						{@const inSetlist = songIdsInSetlist.includes(song._id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
								onclick={() => add(song._id, song.title)}
							>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-medium">{song.title}</span>
									<span class="block truncate text-xs text-muted-foreground">
										{song.artist ?? 'Unknown artist'}
									</span>
								</span>
								{#if song.originalKeyTag}
									<span class="rounded-lg bg-accent px-2 py-0.5 font-chart text-xs">
										{keyName(song.originalKeyTag)}
									</span>
								{/if}
								<span
									class="grid size-8 place-items-center rounded-lg {inSetlist
										? 'text-success'
										: 'bg-primary/15 text-primary'}"
									title={inSetlist ? 'Already on the setlist' : 'Add'}
								>
									{#if inSetlist}<Check class="size-4" />{:else}<Plus class="size-4" />{/if}
								</span>
							</button>
						</li>
					{:else}
						<li class="p-8 text-center text-sm text-muted-foreground">
							{debouncedSearch.current
								? 'No songs match that search.'
								: 'Your library is empty. Paste a song in from the Library page first.'}
						</li>
					{/each}
				</ul>
				{#snippet pending()}
					<div class="flex flex-col gap-2">
						{#each [1, 2, 3] as row (row)}<Skeleton class="h-12 rounded-xl" />{/each}
					</div>
				{/snippet}
			</svelte:boundary>
		</div>
	</Dialog.Content>
</Dialog.Root>
