<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import type { Spelling } from '#convex/constants.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import type { ArrangementBlock, ChartGroup } from '#lib/chart/index.js';
	import { appear, ms } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import ChartGroupView from './chart-group.svelte';
	import { follow } from './follow.js';
	import { handIn, handOut } from './handoff.js';
	import { TextSizes, type ViewerSettings } from './viewer-settings.svelte.js';

	type Props = {
		/** The setlist item on screen; moving to another one follows the current group again. */
		focusedItemId: Id<'JamSessionItem'>;
		/** Its song's title, which a chip names for a few seconds when the leader moves to another song. */
		title: string;
		blocks: ArrangementBlock[];
		/** groupArrangement(blocks), and the focused group's index already clamped to them (the page owns both). */
		groups: ChartGroup[];
		groupIndex: number;
		focusedEpoch: number;
		showChords: boolean;
		semitones: number;
		spelling: Spelling;
		settings: ViewerSettings;
	};
	let {
		focusedItemId,
		title,
		blocks,
		groups,
		groupIndex: index,
		focusedEpoch,
		showChords,
		semitones,
		spelling,
		settings
	}: Props = $props();

	const current = $derived(groups[index]);
	const next = $derived(groups[index + 1]);

	const blockName = (group: ChartGroup) => {
		const block = blocks[group.blockIndex];
		return block?.type === 'section' ? block.section.name : undefined;
	};
	/** Whether this group opens its block, so the block's name heads it in the whole-song view. */
	const opensBlock = (group: ChartGroup) =>
		groups[group.index - 1]?.blockIndex !== group.blockIndex;

	// The next group reads a size down, so the current one stays the obvious thing to sing.
	const smallerSize = $derived(TextSizes[Math.max(0, TextSizes.indexOf(settings.size) - 1)]!.class);

	/*
	 * Whole song follows the current group until the singer scrolls by hand, then waits for "Jump to current".
	 * Switching to Whole song, or the leader moving to another song, follows again. Only the singer's own scroll
	 * pauses it (one right after a finger drag, wheel turn or scroll key), so the page's smooth scrolls never do.
	 */
	const itemId = $derived(focusedItemId); // so a query update on the same item isn't a new song
	let following = $derived.by(() => {
		void itemId;
		return settings.mode === 'song';
	});
	let intentAt = -Infinity;
	const ScrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

	function onscroll() {
		if (performance.now() - intentAt < 300) following = false;
	}
	/** A finger drag, wheel turn or scroll key on the page (not in the settings sheet). */
	function noteIntent(event: Event) {
		if (!(event.target instanceof Element && event.target.closest('[role="dialog"]')))
			intentAt = performance.now();
	}
	function jumpToCurrent() {
		intentAt = -Infinity; // the drag, wheel turn or Space just before this press wasn't a scroll away
		following = true; // the current group's attachment scrolls to it
	}

	/* "Now: <title>" for a few seconds when the leader moves to another song (not on first load). */
	let nowTitle = $state<string>();
	let shownItemId: string | undefined;
	let nowTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (itemId === shownItemId) return;
		const isFirst = shownItemId === undefined;
		shownItemId = itemId;
		if (isFirst) return;
		nowTitle = title;
		clearTimeout(nowTimer);
		nowTimer = setTimeout(() => (nowTitle = undefined), 3500);
	});
</script>

<svelte:window
	{onscroll}
	ontouchmove={noteIntent}
	onwheel={noteIntent}
	onkeydown={(event) => ScrollKeys.has(event.key) && noteIntent(event)}
/>

{#snippet group(group: ChartGroup, lineClass: string)}
	<ChartGroupView
		block={blocks[group.blockIndex]!}
		lines={group.lines}
		{showChords}
		{semitones}
		{spelling}
		{lineClass}
	/>
{/snippet}

<!--
	Changes hand off in place: old and new share one grid cell, so nothing below them jumps, and the new group
	waits for the old one to fade out, so their words never print over each other. Keyed on focusedEpoch + group
	index, so re-focusing the same group still reads as a change.
-->
<!-- Switching view mode fades the stage in again, rather than swapping it in one frame. -->
{#key settings.mode}
	<div in:appear>
		{#if settings.mode === 'song'}
			<!-- Another song fades in, rather than swapping in one frame. -->
			{#key itemId}
				<div class="flex flex-col gap-2 pb-[40vh] text-left" in:appear>
					{#each groups as item (item.key)}
						{@const isCurrent = item.index === index}
						{#if opensBlock(item) && blockName(item)}
							<p
								class="mt-6 px-4 text-xs font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase first:mt-0"
							>
								{blockName(item)}
							</p>
						{/if}
						<div
							class={cn(
								'rounded-3xl border-l-4 px-4 py-3 transition-[opacity,background-color,border-color] duration-500',
								isCurrent ? 'border-primary bg-card opacity-100' : 'border-transparent opacity-35'
							)}
							aria-current={isCurrent ? 'step' : undefined}
							{@attach follow(isCurrent && following, 'center')}
						>
							{@render group(item, cn(settings.size.class, 'font-sans font-semibold leading-snug'))}
						</div>
					{/each}
				</div>
			{/key}
		{:else if current}
			<div class="flex flex-col items-center gap-8 text-center">
				<div class="flex w-full flex-col items-center gap-4">
					<!-- The block's name changes only with the block, so it holds still while a verse steps on. Its line is
					     always there, so a block without a name doesn't move the words. -->
					<p
						class="grid h-4 w-full justify-items-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						{#key blockName(current)}
							<span class="col-start-1 row-start-1" in:handIn out:handOut>
								{blockName(current) ?? ''}
							</span>
						{/key}
					</p>
					<div class="grid w-full grid-cols-1">
						{#key `${focusedEpoch}:${index}`}
							<div
								class="col-start-1 row-start-1 flex min-w-0 flex-col items-center"
								in:handIn={{ y: 12 }}
								out:handOut
							>
								{@render group(
									current,
									cn(
										settings.size.class,
										'justify-center text-center font-sans font-semibold leading-snug'
									)
								)}
							</div>
						{/key}
					</div>
				</div>

				{#if settings.mode === 'next'}
					<!-- The old next group goes at once rather than fading: a taller current group would push it down
					     while it faded. The new one fades in once the current group has settled. -->
					<div class="grid w-full grid-cols-1" aria-label="Next">
						{#key `${focusedEpoch}:${index}`}
							<div
								class="col-start-1 row-start-1 flex min-w-0 flex-col items-center gap-3 opacity-35"
								in:fade={{ duration: ms(320), delay: ms(160) }}
							>
								{#if next}
									<div class="h-px w-16 rounded-full bg-muted-foreground/40"></div>
									<!-- Named when it starts another block: the verse's last group, then the chorus. -->
									{#if opensBlock(next) && blockName(next)}
										<p
											class="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
										>
											{blockName(next)}
										</p>
									{/if}
									{@render group(
										next,
										cn(smallerSize, 'justify-center text-center font-sans leading-snug')
									)}
								{/if}
							</div>
						{/key}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/key}

<!--
	Floats just above the progress bar, so it never moves the words and stays off the top of a new song: Jump to
	current once the singer has scrolled away in Whole song, otherwise the new song's title for a few seconds. One
	cell, so they swap in place.
-->
<div
	class="pointer-events-none fixed inset-x-0 bottom-[calc(2.75rem+env(safe-area-inset-bottom))] z-30 grid items-end justify-items-center px-4 *:col-start-1 *:row-start-1"
>
	{#if settings.mode === 'song' && !following}
		<button
			type="button"
			class="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
			onclick={jumpToCurrent}
			transition:fly={{ y: 16, duration: ms(200) }}
		>
			<LocateFixed class="size-4" /> Jump to current
		</button>
	{:else if nowTitle}
		<p
			class="max-w-full truncate rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40"
			in:handIn={{ y: 16 }}
			out:fade={{ duration: ms(300) }}
		>
			Now: {nowTitle}
		</p>
	{/if}
</div>
