<script lang="ts">
	import { browser } from '$app/env';
	import { useConvexClient } from 'convex-svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import { groupArrangement, keySpelling, type ChartGroup } from '#lib/chart/index.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import ChartGroupView from '#lib/components/live/chart-group.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { cn } from '#lib/utils.js';

	type Console = NonNullable<FunctionReturnType<typeof api.jam_session.get>>;
	let { session, items }: { session: Console['session']; items: Console['items'] } = $props();

	const client = useConvexClient();
	const itemIndex = $derived(items.findIndex((item) => item._id === session.focusedItemId));
	const item = $derived(items[itemIndex]);
	const groupIndex = $derived(session.focusedGroupIndex ?? 0);

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
</script>

<svelte:window {onkeydown} />

<section class="flex flex-col gap-4">
	{#if item}
		<!-- A fresh subtree per song: the keyed group list doesn't reliably drop the old song's groups when
		     its awaited arrangement changes underneath it. -->
		{#key item.song._id}
			<svelte:boundary pending={browser ? pending : undefined}>
				{@const arrangement = await convexQuery(api.song.getArrangement, { songId: item.song._id })}
				{@const groups = arrangement ? groupArrangement(arrangement.blocks) : []}
				{@const spelling = keySpelling(item.song.originalKeyTag, item.transposeSemitones)}
				{@const isFirst = itemIndex === 0 && groupIndex === 0}
				{@const isLast = itemIndex === items.length - 1 && groupIndex >= groups.length - 1}

				<header class="flex items-baseline justify-between gap-3 px-1">
					<h2 class="truncate text-xl font-bold">{item.song.title}</h2>
					<span class="shrink-0 text-sm text-muted-foreground tabular-nums">
						Group {Math.min(groupIndex, groups.length - 1) + 1} of {groups.length}
					</span>
				</header>

				<ol class="flex flex-col gap-2">
					{#each groups as group (group.key)}
						{@render groupCard(group, groups, arrangement!.blocks)}
					{/each}
				</ol>

				<!-- Thumb reach on a phone, under the chart on a laptop. -->
				<div
					class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-3 bg-gradient-to-t from-background from-60% to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-4 lg:rounded-3xl lg:px-0 lg:pt-4 lg:pb-0"
				>
					<button
						type="button"
						class="flex h-16 items-center justify-center gap-2 rounded-2xl bg-card text-lg font-semibold shadow-lg shadow-black/25 transition-[transform,background-color,color] active:scale-[0.97] disabled:bg-card/60 disabled:text-muted-foreground disabled:shadow-none"
						disabled={isFirst}
						onclick={() => step(-1)}
					>
						<ChevronLeft class="size-6" /> Prev
					</button>
					<button
						type="button"
						class="flex h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-black/25 transition-[transform,background-color,color] active:scale-[0.97] disabled:bg-card/60 disabled:text-muted-foreground disabled:shadow-none"
						disabled={isLast}
						onclick={() => step(1)}
					>
						{groupIndex >= groups.length - 1 && items[itemIndex + 1] ? 'Next song' : 'Next'}
						<ChevronRight class="size-6" />
					</button>
				</div>
			</svelte:boundary>
		{/key}
	{:else}
		<div
			class="grid min-h-48 place-items-center rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground"
		>
			{items.length
				? 'Tap a song in the setlist to show it.'
				: 'Add songs to the setlist to begin.'}
		</div>
	{/if}
</section>

{#snippet pending()}
	<Skeleton class="h-8 w-48 rounded-xl" />
	<Skeleton class="h-64 w-full rounded-2xl" />
{/snippet}

{#snippet groupCard(
	group: ChartGroup,
	groups: ChartGroup[],
	blocks: NonNullable<FunctionReturnType<typeof api.song.getArrangement>>['blocks']
)}
	{@const block = blocks[group.blockIndex]!}
	{@const isCurrent = group.index === Math.min(groupIndex, groups.length - 1)}
	{@const opensBlock = groups[group.index - 1]?.blockIndex !== group.blockIndex}
	<li>
		{#if opensBlock && block.type === 'section'}
			<p
				class="mt-3 mb-1.5 px-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
			>
				{block.section.name}
			</p>
		{/if}
		<button
			type="button"
			class={cn(
				'w-full scroll-mt-24 scroll-mb-36 rounded-2xl border-2 px-4 py-3 text-left transition-colors',
				isCurrent ? 'border-primary bg-card' : 'border-transparent bg-card/60 hover:bg-card'
			)}
			aria-current={isCurrent ? 'step' : undefined}
			onclick={() =>
				client.mutation(api.jam_session.setFocus, {
					jamSessionId: session._id,
					itemId: item!._id,
					groupIndex: group.index
				})}
			{@attach (element) => {
				if (isCurrent) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}}
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
