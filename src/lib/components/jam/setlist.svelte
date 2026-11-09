<script lang="ts">
	import { slide } from 'svelte/transition';
	import { useConvexClient } from 'convex-svelte';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { api } from '#convex/_generated/api.js';
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { keyName, transposeKey } from '#lib/chart/index.js';
	import { sortable } from '#lib/sortable.js';
	import TransposeControl from '#lib/components/chart/transpose-control.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';

	type Console = NonNullable<FunctionReturnType<typeof api.jam_session.get>>;
	let { session, items }: { session: Console['session']; items: Console['items'] } = $props();

	const client = useConvexClient();
	/** The row whose transpose / remove controls are open. */
	let openItemId = $state<Id<'JamSessionItem'>>();

	const focus = (itemId: Id<'JamSessionItem'>) =>
		client.mutation(api.jam_session.setFocus, { jamSessionId: session._id, itemId, groupIndex: 0 });

	function keyLabel(item: Console['items'][number]) {
		const { originalKeyTag } = item.song;
		if (originalKeyTag) return keyName(transposeKey(originalKeyTag, item.transposeSemitones).tag);
		if (item.transposeSemitones === 0) return 'Key';
		return `${item.transposeSemitones > 0 ? '+' : ''}${item.transposeSemitones}`;
	}
</script>

{#if items.length}
	<ol
		class="flex flex-col gap-1.5"
		{@attach sortable({
			handle: '.drag-handle',
			onUpdate: async ({ item, newIds }) => {
				const index = newIds.indexOf(item.dataset.id!);
				await client.mutation(api.jam_session.moveItem, {
					itemId: item.dataset.id as Id<'JamSessionItem'>,
					previousId: newIds[index - 1] as Id<'JamSessionItem'> | undefined,
					nextId: newIds[index + 1] as Id<'JamSessionItem'> | undefined
				});
			}
		})}
	>
		{#each items as item, index (item._id)}
			{@const isFocused = item._id === session.focusedItemId}
			<li
				data-id={item._id}
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
							'h-8 min-w-12 shrink-0 rounded-lg px-2 font-chart text-sm transition-colors hover:bg-accent',
							item.transposeSemitones !== 0 ? 'bg-primary/15 text-primary' : 'bg-accent/60',
							openItemId === item._id && 'ring-2 ring-ring'
						)}
						aria-expanded={openItemId === item._id}
						aria-label="Key and options for {item.song.title}"
						onclick={() => (openItemId = openItemId === item._id ? undefined : item._id)}
					>
						{keyLabel(item)}
					</button>
				</div>

				{#if openItemId === item._id}
					<div
						class="flex items-center justify-between gap-2 px-3 pb-3"
						transition:slide={{ duration: 180 }}
					>
						<TransposeControl
							bind:semitones={
								() => item.transposeSemitones,
								(semitones) =>
									client.mutation(api.jam_session.setTranspose, { itemId: item._id, semitones })
							}
							keyTag={item.song.originalKeyTag}
						/>
						<Button
							variant="ghost"
							size="icon"
							class="rounded-xl text-muted-foreground hover:text-destructive"
							aria-label="Remove {item.song.title} from the setlist"
							onclick={() => client.mutation(api.jam_session.removeItem, { itemId: item._id })}
						>
							<Trash />
						</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{:else}
	<p class="rounded-2xl bg-background/40 p-6 text-center text-sm text-muted-foreground">
		No songs yet. Add some from your library.
	</p>
{/if}
