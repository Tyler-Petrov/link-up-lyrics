<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { Spelling } from '#convex/constants.js';
	import type { ArrangementBlock, ChartGroup } from '#lib/chart/index.js';
	import { cn } from '#lib/utils.js';
	import ChartGroupView from './chart-group.svelte';
	import { TextSizes, type ViewerSettings } from './viewer-settings.svelte.js';

	type Props = {
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

	const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

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
	Changes cross-fade in place: old and new share one grid cell, so nothing below them jumps while both are
	on screen. Keyed on focusedEpoch + group index, so re-focusing the same group still reads as a change.
-->
{#if settings.mode === 'song'}
	<div class="flex flex-col gap-2 pb-[40vh] text-left">
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
					isCurrent ? 'border-primary bg-primary/10 opacity-100' : 'border-transparent opacity-35'
				)}
				aria-current={isCurrent ? 'step' : undefined}
				{@attach (element) => {
					if (isCurrent)
						element.scrollIntoView({
							block: 'center',
							behavior: reducedMotion() ? 'instant' : 'smooth'
						});
				}}
			>
				{@render group(item, cn(settings.size.class, 'font-sans font-semibold leading-snug'))}
			</div>
		{/each}
	</div>
{:else if current}
	<div class="flex flex-col items-center gap-8 text-center">
		<div class="grid w-full grid-cols-1">
			{#key `${focusedEpoch}:${index}`}
				<div
					class="col-start-1 row-start-1 flex min-w-0 flex-col items-center gap-4"
					in:fly={{ y: 12, duration: 320, delay: 80 }}
					out:fade={{ duration: 160 }}
				>
					{#if blockName(current)}
						<p class="text-xs font-semibold tracking-[0.2em] text-primary/80 uppercase">
							{blockName(current)}
						</p>
					{/if}
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

		{#if settings.mode === 'next'}
			<div class="grid w-full grid-cols-1" aria-label="Next">
				{#key `${focusedEpoch}:${index}`}
					<div
						class="col-start-1 row-start-1 flex min-w-0 flex-col items-center gap-3 opacity-35"
						in:fade={{ duration: 320, delay: 160 }}
						out:fade={{ duration: 120 }}
					>
						{#if next}
							<div class="h-px w-16 rounded-full bg-muted-foreground/40"></div>
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
