<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import type { OptimisticLocalStore } from 'convex/browser';
	import type { FunctionReturnType } from 'convex/server';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { keyName, transposeKey } from '#lib/chart/index.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import { reveal } from '#lib/motion.js';
	import { sortable } from '#lib/sortable.js';
	import TransposeControl from '#lib/components/chart/transpose-control.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';

	type Console = NonNullable<FunctionReturnType<typeof api.jam_session.get>>;
	type Item = Console['items'][number];
	type Props = {
		session: Console['session'];
		items: Item[];
		/** After a tap on a song, e.g. to close the sheet it's in. */
		onpick?: () => void;
	};
	let { session, items, onpick }: Props = $props();

	const client = useConvexClient();
	/** The row whose transpose / remove controls are open. */
	let openItemId = $state<Id<'JamSessionItem'>>();

	/**
	 * Shows a setlist change in the console's query while it saves, so quick transpose presses build on each
	 * other and a drop lands at once. A failed save rolls it back.
	 */
	function patchItems(store: OptimisticLocalStore, update: (items: Item[]) => Item[]) {
		const args = { jamSessionId: session._id };
		const current = store.getQuery(api.jam_session.get, args);
		if (current)
			store.setQuery(api.jam_session.get, args, { ...current, items: update(current.items) });
	}

	function focus(itemId: Id<'JamSessionItem'>) {
		void client.mutation(api.jam_session.setFocus, {
			jamSessionId: session._id,
			itemId,
			groupIndex: 0
		});
		onpick?.();
	}

	const setTranspose = (itemId: Id<'JamSessionItem'>, semitones: number) =>
		client.mutation(
			api.jam_session.setTranspose,
			{ itemId, semitones },
			{
				optimisticUpdate: (store) =>
					patchItems(store, (items) =>
						items.map((item) =>
							item._id === itemId ? { ...item, transposeSemitones: semitones } : item
						)
					)
			}
		);

	/** One tap, unless it's the song the room is on: then everyone's phone moves, so ask first. */
	async function remove(item: Item, index: number) {
		if (session.isLive && item._id === session.focusedItemId) {
			const next = items[index + 1];
			const confirmed = await confirmation({
				title: 'Remove the song everyone’s on?',
				message: next
					? `Phones following along will move on to “${next.song.title}”.`
					: 'Phones following along will wait for the next song.',
				confirmLabel: 'Remove'
			});
			if (!confirmed) return;
		}
		await client.mutation(api.jam_session.removeItem, { itemId: item._id });
	}

	function keyLabel(item: Item) {
		const { originalKeyTag } = item.song;
		if (originalKeyTag) return keyName(transposeKey(originalKeyTag, item.transposeSemitones).tag);
		if (item.transposeSemitones === 0) return 'Key';
		return `${item.transposeSemitones > 0 ? '+' : ''}${item.transposeSemitones}`;
	}
</script>

<!-- Rows space themselves with a bottom margin (the list takes the last one back), so the space slides open and
     closed with each row instead of a gap appearing at once. No animate:glide: Sortable already showed the move,
     and a glide would replay it from the old slot after the drop. -->
<ol
	class="-mb-1.5 flex flex-col"
	{@attach sortable({
		handle: '.drag-handle',
		onUpdate: async ({ item: row, newIds }) => {
			const itemId = row.dataset.id as Id<'JamSessionItem'>;
			const index = newIds.indexOf(itemId);
			await client.mutation(
				api.jam_session.moveItem,
				{
					itemId,
					previousId: newIds[index - 1] as Id<'JamSessionItem'> | undefined,
					nextId: newIds[index + 1] as Id<'JamSessionItem'> | undefined
				},
				{
					optimisticUpdate: (store) =>
						patchItems(store, (items) => {
							const moved = items.find((item) => item._id === itemId);
							if (!moved) return items;
							const rest = items.filter((item) => item !== moved);
							rest.splice(index, 0, moved);
							return rest;
						})
				}
			);
		}
	})}
>
	{#each items as item, index (item._id)}
		{@const isFocused = item._id === session.focusedItemId}
		{@const isOpen = openItemId === item._id}
		<li data-id={item._id} class="mb-1.5" transition:reveal>
			<div
				class={cn(
					'rounded-2xl border-2 transition-colors',
					isFocused ? 'border-primary bg-card' : 'border-transparent bg-background/40'
				)}
			>
				<div class="flex items-center gap-1 py-1 pr-1.5 pl-0.5">
					<span
						class="drag-handle grid h-10 w-7 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground/50 active:cursor-grabbing"
						aria-label="Drag to reorder"
					>
						<GripVertical class="size-4" />
					</span>
					<button
						type="button"
						class="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1.5 text-left"
						onclick={() => focus(item._id)}
						aria-current={isFocused ? 'true' : undefined}
					>
						<span
							class={cn(
								'w-5 shrink-0 text-right text-sm tabular-nums',
								isFocused ? 'font-bold text-primary' : 'text-muted-foreground'
							)}>{index + 1}</span
						>
						<span class="min-w-0">
							<span class="block truncate font-semibold">{item.song.title}</span>
							{#if item.song.artist}
								<span class="block truncate text-xs text-muted-foreground">{item.song.artist}</span>
							{/if}
						</span>
					</button>
					<button
						type="button"
						class={cn(
							'flex h-8 min-w-14 shrink-0 items-center justify-center gap-0.5 rounded-lg pr-1.5 pl-2 font-chart text-sm transition-colors hover:bg-accent pointer-coarse:h-10',
							item.transposeSemitones !== 0 ? 'bg-primary/15 text-primary' : 'bg-accent/60',
							isOpen && 'ring-2 ring-ring'
						)}
						title="Key and remove"
						aria-expanded={isOpen}
						aria-label="Key and remove for {item.song.title}"
						onclick={() => (openItemId = isOpen ? undefined : item._id)}
					>
						{keyLabel(item)}
						<ChevronDown
							class={cn(
								'size-3.5 opacity-60 transition-transform duration-200',
								isOpen && 'rotate-180'
							)}
						/>
					</button>
				</div>

				{#if isOpen}
					<div class="flex items-center justify-between gap-2 px-3 pb-3" transition:reveal>
						<TransposeControl
							bind:semitones={
								() => item.transposeSemitones, (semitones) => setTranspose(item._id, semitones)
							}
							keyTag={item.song.originalKeyTag}
						/>
						<Button
							variant="ghost"
							class="rounded-xl text-muted-foreground hover:text-destructive"
							aria-label="Remove {item.song.title} from the setlist"
							onclick={() => remove(item, index)}
						>
							<Trash /> Remove
						</Button>
					</div>
				{/if}
			</div>
		</li>
	{:else}
		<li
			class="mb-1.5 rounded-2xl bg-background/40 p-6 text-center text-sm text-muted-foreground"
			transition:reveal
		>
			No songs yet. Add some from your library.
		</li>
	{/each}
</ol>
