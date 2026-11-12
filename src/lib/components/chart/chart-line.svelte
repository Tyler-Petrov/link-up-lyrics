<script lang="ts">
	import type { Spelling } from '#convex/constants.js';
	import type { ChartCharacter } from '#convex/validators.js';
	import { chartWords, formatChord, hasChords, isInstrumental } from '#convex/shared/chart/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		characters: ChartCharacter[];
		semitones?: number;
		spelling?: Spelling;
		/** False for the room's lyrics-only view. */
		showChords?: boolean;
		class?: string;
	};
	let {
		characters,
		semitones = 0,
		spelling = 'sharp',
		showChords = true,
		class: className
	}: Props = $props();

	// Words wrap; within a word, one two-row column per chord keeps the chord over its syllable. Plan §8.
	const words = $derived(chartWords(characters));
	/**
	 * Chords over nothing but space (an interlude's line): each gets room, and the spaces keep their width but
	 * not a row of their own.
	 */
	const instrumental = $derived(showChords && hasChords(characters) && isInstrumental(characters));
</script>

<!--
	Only a chord takes room in the chord row, so a word is never wider than its letters unless its own chord needs
	the space, and a wrapped piece with no chords has no empty row above it. Wrapped pieces hang in by 2ch, so
	they read as the rest of the line above rather than a new line.
-->
<div class={cn('flex flex-wrap items-end pl-[2ch] font-chart text-lg leading-snug', className)}>
	{#each words as word (word.start)}
		<span class="inline-flex items-end whitespace-pre first:-ml-[2ch]">
			{#each word.segments as segment (segment.start)}
				{#if showChords && segment.chord}
					<span class={cn('inline-flex flex-col', instrumental && 'min-w-[4ch]')}>
						<span class="pr-[0.5ch] text-sm font-bold text-chord"
							>{formatChord(segment.chord, semitones, spelling)}</span
						>
						<span class={[instrumental && 'h-0']}>{segment.text}</span>
					</span>
				{:else}
					<span class={[instrumental && 'h-0']}>{segment.text}</span>
				{/if}
			{/each}
		</span>
	{:else}
		<span class="whitespace-pre"> </span>
	{/each}
</div>
