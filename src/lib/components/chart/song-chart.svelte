<script lang="ts">
	import Repeat from '@lucide/svelte/icons/repeat-2';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import type { Spelling } from '#convex/constants.js';
	import type { ArrangementBlock } from '#lib/chart/index.js';
	import { groupArrangement, hasChords } from '#lib/chart/index.js';
	import ChartLine from './chart-line.svelte';

	type Props = {
		blocks: ArrangementBlock[];
		semitones?: number;
		spelling?: Spelling;
		showChords?: boolean;
	};
	let { blocks, semitones = 0, spelling = 'sharp', showChords = true }: Props = $props();

	const groups = $derived(groupArrangement(blocks));
</script>

<!-- Read-only chart: blocks in play order, each split into its line groups (a bar in the gutter), repeats
     rendered from their source. -->
<div class="flex flex-col gap-8 print:gap-4">
	{#each blocks as block, blockIndex (block.key)}
		{@const blockGroups = groups.filter((group) => group.blockIndex === blockIndex)}
		{@const isInterlude = block.type === 'section' && block.source.kindTag === 'interlude'}
		{@const musicOnly =
			isInterlude && (!showChords || !block.lines.some((line) => hasChords(line.characters)))}
		<!-- A block with no lines yet (a new "Bridge") is only a heading; leave it out until it has some. -->
		{#if block.lines.length || isInterlude}
			<section class="flex flex-col gap-2">
				{#if block.type === 'section'}
					<h3
						class="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
					>
						{block.section.name}
						{#if block.isRepeat}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium normal-case"
								title="Repeats {block.source.name}"
							>
								<Repeat class="size-3" />
								{block.source.name === block.section.name ? 'Repeat' : block.source.name}
							</span>
						{/if}
					</h3>
				{/if}

				<!-- Singers (and chordless interludes) get a card instead of empty lines. -->
				{#if musicOnly}
					<div
						class="flex items-center gap-2 rounded-xl bg-accent/60 px-4 py-3 text-muted-foreground italic"
					>
						<AudioLines class="size-4" />
						Music only
					</div>
				{:else}
					<!-- Every group alike (a rounded bar beside it), so none looks picked out; the gap between them
					     shows where one ends. -->
					<div class="flex flex-col gap-3">
						{#each blockGroups as group (group.key)}
							<div
								class="relative flex flex-col gap-1 pl-4 before:absolute before:inset-y-0.5 before:left-0 before:w-1 before:rounded-full before:bg-muted-foreground/30"
							>
								{#each group.lines as line (line._id)}
									<ChartLine
										characters={line.characters}
										{semitones}
										{spelling}
										{showChords}
										class={line.kindTag === 'comment' ? 'text-muted-foreground italic' : undefined}
									/>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{/each}
</div>
