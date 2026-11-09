<script lang="ts">
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import type { Spelling } from '#convex/constants.js';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import { hasChords, lineText, type ArrangementBlock } from '#lib/chart/index.js';
	import ChartLine from '#lib/components/chart/chart-line.svelte';
	import { cn } from '#lib/utils.js';

	type Props = {
		block: ArrangementBlock;
		lines: Doc<'SongLine'>[];
		showChords: boolean;
		semitones?: number;
		spelling?: Spelling;
		/** Classes for each line (type size, font). */
		lineClass?: string;
		class?: string;
	};
	let {
		block,
		lines,
		showChords,
		semitones = 0,
		spelling = 'sharp',
		lineClass,
		class: className
	}: Props = $props();

	// Singers get a card for an interlude, and so do players when it carries no chords. §9.
	const musicOnly = $derived(
		block.type === 'section' &&
			block.source.kindTag === 'interlude' &&
			(!showChords || !lines.some((line) => hasChords(line.characters)))
	);
</script>

<!-- One line group, as the leader advances through them live. Wraps ChartLine. -->
{#if musicOnly}
	<div
		class={cn(
			'flex items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-foreground/[0.035] px-5 py-4 text-muted-foreground',
			className
		)}
	>
		<AudioLines class="size-[1.2em] shrink-0 text-chord" />
		<span class="flex flex-col">
			<span class="font-semibold text-foreground">
				{block.type === 'section' ? block.section.name : 'Interlude'}
			</span>
			<span class="text-[0.8em] italic">Music only</span>
		</span>
	</div>
{:else}
	<div class={cn('flex flex-col gap-1', className)}>
		{#each lines as line (line._id)}
			{@const lineClasses = cn(
				lineClass,
				line.kindTag === 'comment' && 'text-[0.75em] text-muted-foreground italic'
			)}
			{#if showChords}
				<ChartLine characters={line.characters} {semitones} {spelling} class={lineClasses} />
			{:else}
				<!-- Words only: plain text, so long lines wrap at word boundaries on a phone. -->
				<p class={cn('text-pretty', lineClasses)}>{lineText(line.characters)}</p>
			{/if}
		{/each}
	</div>
{/if}
