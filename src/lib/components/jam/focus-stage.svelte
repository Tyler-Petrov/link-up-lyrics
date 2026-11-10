<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import { groupArrangement, keySpelling, type ChartGroup } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { appear } from '#lib/motion.js';
	import ChartGroupView from '#lib/components/live/chart-group.svelte';
	import { follow } from '#lib/components/live/follow.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { cn } from '#lib/utils.js';
	import AddSongDialog from './add-song-dialog.svelte';
	import Setlist from './setlist.svelte';

	type Console = NonNullable<FunctionReturnType<typeof api.jam_session.get>>;
	let { session, items }: { session: Console['session']; items: Console['items'] } = $props();

	const client = useConvexClient();
	const itemIndex = $derived(items.findIndex((item) => item._id === session.focusedItemId));
	const item = $derived(items[itemIndex]);
	const songId = $derived(item?.song._id);
	// Awaited here rather than in the markup: picking another song keeps this one up until the next has loaded,
	// then swaps, so there's no skeleton in between.
	const arrangement = $derived(
		songId ? await convexQuery(api.song.getArrangement, { songId }) : null
	);
	const groups = $derived(arrangement ? groupArrangement(arrangement.blocks) : []);
	const groupIndex = $derived(
		Math.min(session.focusedGroupIndex ?? 0, Math.max(0, groups.length - 1))
	);
	const atLastGroup = $derived(groupIndex >= groups.length - 1);
	const atEnd = $derived(!!item && itemIndex === items.length - 1 && atLastGroup);

	/** The setlist sheet, below lg (wider screens have the setlist beside the song). */
	let setlistOpen = $state(false);

	const step = (direction: 1 | -1) =>
		client.mutation(api.jam_session.step, { jamSessionId: session._id, direction });

	/* Arrows, space and PageUp/PageDown (what presentation clickers send) step through groups. */
	function onkeydown(event: KeyboardEvent) {
		const target = event.target instanceof Element ? event.target : document.body;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
		const forward = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key);
		const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key);
		const space = event.key === ' ' && !target.closest('button, a');
		if (!forward && !back && !space) return;
		event.preventDefault();
		void step(back || (space && event.shiftKey) ? -1 : 1);
	}

	const barButton =
		'flex h-16 items-center justify-center gap-2 rounded-2xl text-lg font-semibold shadow-lg shadow-black/25 transition-[transform,background-color,color] active:scale-[0.97] disabled:bg-card/60 disabled:text-muted-foreground disabled:shadow-none disabled:ring-1 disabled:ring-border';
</script>

<svelte:window {onkeydown} />

<section class="flex flex-col gap-4">
	{#if arrangement && item}
		<!-- A fresh subtree per setlist item, which fades in once its song has loaded. -->
		{#key item._id}
			<div class="flex flex-col gap-4" in:appear>
				<!-- A song's first group brings its title into view too, so the leader sees which song the room moved to. -->
				<header
					class="flex scroll-mt-40 items-baseline justify-between gap-3 px-1"
					{@attach follow(groupIndex === 0)}
				>
					<h2 class="truncate text-xl font-bold">{item.song.title}</h2>
					<span class="shrink-0 text-sm text-muted-foreground tabular-nums">
						Group {groupIndex + 1} of {groups.length}
					</span>
				</header>

				<ol class="flex flex-col gap-2">
					{#each groups as group (group.key)}
						{@render groupCard(group, arrangement.blocks)}
					{/each}
				</ol>
			</div>
		{/key}
	{:else}
		<div
			class="grid min-h-48 place-items-center content-center gap-4 rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground"
		>
			<p>
				{items.length
					? 'Tap a song in the setlist, or press Start, to show it.'
					: 'Add songs to the setlist to begin.'}
			</p>
			<!-- Below lg the setlist is a sheet, so its Add songs is here too. Shown either way, so adding the first
			     song doesn't close the dialog. -->
			<div class="lg:hidden">
				<AddSongDialog
					jamSessionId={session._id}
					songIdsInSetlist={items.map((item) => item.song._id)}
				/>
			</div>
		</div>
	{/if}

	<!-- Thumb reach on a phone, under the chart on a laptop. Always here, so it never blinks between songs. -->
	<div
		class={[
			'fixed inset-x-0 bottom-0 z-30 grid grid-cols-[4rem_1fr_1fr] gap-3 bg-gradient-to-t from-background from-80% to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-4 lg:grid-cols-2 lg:rounded-3xl lg:bg-background/85 lg:bg-none lg:p-2 lg:backdrop-blur-md',
			!items.length && 'lg:hidden'
		]}
	>
		{#if item}
			<!-- On a phone the song's title has usually scrolled away; this names the song and group Next steps from. -->
			<p
				class="col-span-full -mb-1 flex justify-center gap-1.5 text-xs text-muted-foreground lg:hidden"
				in:appear
			>
				<span class="truncate font-semibold text-foreground">{item.song.title}</span>
				<span class="shrink-0 tabular-nums">· Group {groupIndex + 1} of {groups.length}</span>
			</p>
		{/if}
		<Dialog.Root bind:open={setlistOpen}>
			<Dialog.Trigger
				class="flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-card text-xs font-semibold shadow-lg shadow-black/25 transition-transform active:scale-[0.97] lg:hidden"
			>
				<ListMusic class="size-6" /> Setlist
			</Dialog.Trigger>
			<!-- A bottom sheet, like the live page's settings. -->
			<Dialog.Content
				showCloseButton={false}
				class="top-auto bottom-0 left-1/2 flex max-h-[85dvh] max-w-[min(100%-1rem,28rem)] translate-y-0 flex-col gap-3 rounded-t-3xl rounded-b-none bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-base sm:bottom-4 sm:max-w-md sm:rounded-3xl data-open:zoom-in-100 data-open:slide-in-from-bottom data-closed:zoom-out-100 data-closed:slide-out-to-bottom"
			>
				<Dialog.Header class="flex-row items-center justify-between gap-2 pl-2">
					<Dialog.Title class="text-lg">Setlist</Dialog.Title>
					<AddSongDialog
						jamSessionId={session._id}
						songIdsInSetlist={items.map((item) => item.song._id)}
					/>
				</Dialog.Header>
				<Dialog.Description class="sr-only">
					Tap a song to show it. Drag to reorder.
				</Dialog.Description>
				<div class="-mx-3 min-h-0 overflow-y-auto px-3">
					<Setlist {session} {items} onpick={() => (setlistOpen = false)} />
				</div>
			</Dialog.Content>
		</Dialog.Root>
		<button
			type="button"
			class={cn(barButton, 'bg-card')}
			disabled={!item || (itemIndex === 0 && groupIndex === 0)}
			onclick={() => step(-1)}
		>
			<ChevronLeft class="size-6" /> Prev
		</button>
		<button
			type="button"
			class={cn(barButton, 'bg-primary text-primary-foreground')}
			disabled={atEnd || !items.length}
			onclick={() => step(1)}
		>
			{#if atEnd}
				End of setlist
			{:else}
				{!item ? 'Start' : atLastGroup ? 'Next song' : 'Next'}
				<ChevronRight class="size-6" />
			{/if}
		</button>
		<p class="col-span-2 -mt-1 text-center text-xs text-muted-foreground/70 max-lg:hidden">
			<kbd class="font-sans">←</kbd> <kbd class="font-sans">→</kbd>, Space, or a clicker
		</p>
	</div>
</section>

{#snippet groupCard(
	group: ChartGroup,
	blocks: NonNullable<FunctionReturnType<typeof api.song.getArrangement>>['blocks']
)}
	{@const block = blocks[group.blockIndex]!}
	{@const isCurrent = group.index === groupIndex}
	{@const opensBlock = groups[group.index - 1]?.blockIndex !== group.blockIndex}
	<li>
		{#if opensBlock && block.type === 'section'}
			<p
				class="mt-3 mb-1.5 px-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
			>
				{block.section.name}
			</p>
		{/if}
		<!-- Scroll margins clear the app header and status card above, and the Prev/Next bar below. -->
		<button
			type="button"
			class={cn(
				'w-full scroll-mt-40 scroll-mb-36 rounded-2xl border-2 px-4 py-3 text-left transition-colors',
				isCurrent ? 'border-primary bg-card' : 'border-transparent bg-card/60 hover:bg-card'
			)}
			aria-current={isCurrent ? 'step' : undefined}
			onclick={() =>
				client.mutation(api.jam_session.setFocus, {
					jamSessionId: session._id,
					itemId: item!._id,
					groupIndex: group.index
				})}
			{@attach follow(isCurrent && group.index > 0)}
		>
			<ChartGroupView
				{block}
				lines={group.lines}
				showChords
				semitones={item!.transposeSemitones}
				spelling={keySpelling(item!.song.originalKeyTag, item!.transposeSemitones)}
				lineClass="text-base"
			/>
		</button>
	</li>
{/snippet}
