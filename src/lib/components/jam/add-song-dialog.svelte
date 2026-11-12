<script lang="ts">
	import { Debounced } from 'runed';
	import { SvelteSet } from 'svelte/reactivity';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { keyName } from '#convex/shared/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { appear } from '#lib/motion.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		jamSessionId: Id<'JamSession'>;
		/** Songs already on the setlist, which can't be added twice. */
		songIdsInSetlist: Id<'Song'>[];
	};
	let { jamSessionId, songIdsInSetlist }: Props = $props();

	const client = useConvexClient();
	let open = $state(false);
	let content = $state<HTMLElement | null>(null);
	let search = $state('');
	const debouncedSearch = new Debounced(() => search.trim(), 250);

	// Read without `await`: a pending await in a dialog holds back the update that would close it. A new search
	// keeps the last list up, with a spinner in the search icon's place, until its results arrive.
	const query = $derived(
		convexQuery(
			api.song.listMine,
			debouncedSearch.current ? { search: debouncedSearch.current } : {}
		)
	);
	let lastSongs: typeof query.current;
	const songs = $derived.by(() => (lastSongs = query.current ?? lastSongs));
	const searching = $derived(query.isLoading || search.trim() !== debouncedSearch.current);

	/** Added from this dialog, so the check shows at once rather than when the setlist comes back with them. */
	const added = new SvelteSet<Id<'Song'>>();

	async function add(songId: Id<'Song'>) {
		added.add(songId);
		try {
			await client.mutation(api.jam_session.addSong, { jamSessionId, songId });
		} catch (error) {
			added.delete(songId);
			toast.error(errorMessage(error, 'Couldn’t add that song. Try again.'));
		}
	}
</script>

<Dialog.Root bind:open>
	<Button
		variant="secondary"
		class="rounded-xl"
		onclick={() => {
			added.clear();
			open = true;
		}}
	>
		<Plus /> Add songs
	</Button>
	<!-- A set height, so the list changing as you search never moves the centred dialog. On a touch screen it
	     opens on the list, not the search field, so the keyboard doesn't cover the songs you came to tap. -->
	<Dialog.Content
		bind:ref={content}
		class="flex h-[min(40rem,90dvh)] flex-col rounded-2xl sm:max-w-lg"
		onOpenAutoFocus={(event) => {
			if (!matchMedia('(pointer: coarse)').matches) return;
			event.preventDefault();
			content?.focus({ preventScroll: true });
		}}
	>
		<Dialog.Header>
			<Dialog.Title>Add songs from your library</Dialog.Title>
			<Dialog.Description>They go to the end of the setlist. Drag to reorder.</Dialog.Description>
		</Dialog.Header>
		<div class="relative">
			<!-- The spinner takes the icon's place after 150ms (a CSS delay), so a quick search never flashes it. -->
			<span
				class="pointer-events-none absolute top-1/2 left-3 grid size-4 -translate-y-1/2 text-muted-foreground *:col-start-1 *:row-start-1 *:size-4 *:transition-opacity"
				aria-hidden="true"
			>
				<Search class={searching ? 'opacity-0 delay-150' : ''} />
				<LoaderCircle
					class={cn('motion-safe:animate-spin', searching ? 'delay-150' : 'opacity-0')}
				/>
			</span>
			<Input
				bind:value={search}
				placeholder="Search your songs"
				class="h-10 rounded-xl pl-9"
				type="search"
				aria-busy={searching}
			/>
		</div>
		<div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
			{#if songs}
				<ul class="flex flex-col gap-1">
					{#each songs as song (song._id)}
						{@const inSetlist = songIdsInSetlist.includes(song._id) || added.has(song._id)}
						<li in:appear>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors enabled:hover:bg-accent"
								disabled={inSetlist}
								onclick={() => add(song._id)}
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
								<!-- One fixed slot, so the + turning into "Added" moves nothing. -->
								<span class="flex w-16 justify-end">
									{#if inSetlist}
										<span
											class="flex h-8 items-center gap-1 text-xs font-semibold text-success"
											in:appear
										>
											<Check class="size-4" /> Added
										</span>
									{:else}
										<span
											class="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"
											aria-label="Add"
										>
											<Plus class="size-4" />
										</span>
									{/if}
								</span>
							</button>
						</li>
					{:else}
						<li class="p-8 text-center text-sm text-muted-foreground" in:appear>
							{debouncedSearch.current
								? 'No songs match that search.'
								: 'Your library is empty. Paste a song in from the Library page first.'}
						</li>
					{/each}
				</ul>
			{:else if query.error}
				<p class="p-8 text-center text-sm text-muted-foreground">
					{errorMessage(query.error, 'Couldn’t load your songs. Close this and try again.')}
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each [1, 2, 3, 4] as row (row)}<Skeleton class="h-[3.75rem] rounded-xl" />{/each}
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
