<script lang="ts">
	import type { Spelling } from '#convex/constants.js';
	import type { ChartCharacter } from '#convex/validators.js';
	import { chartWords, formatChord } from '#lib/chart/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		characters: ChartCharacter[];
		semitones?: number;
		spelling?: Spelling;
		/** False for the room's lyrics-only view. When true the chord row is always reserved, so lines don't
		    jump when a chord appears. */
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
</script>

<div class={cn('flex flex-wrap items-end font-chart text-lg leading-snug', className)}>
	{#each words as word (word.start)}
		<span class="inline-flex items-end whitespace-pre">
			{#each word.segments as segment (segment.start)}
				{@const label =
					showChords && segment.chord ? formatChord(segment.chord, semitones, spelling) : undefined}
				<!-- A chord over nothing but space (an instrumental line) gets room so chords don't run together. -->
				<span class={cn('inline-flex flex-col', label && !segment.text.trim() && 'min-w-[4ch]')}>
					{#if showChords}
						<span class={cn('pr-[0.5ch] text-sm font-bold text-chord', !label && 'invisible')}
							>{label ?? ' '}</span
						>
					{/if}
					<span>{segment.text}</span>
				</span>
			{/each}
		</span>
	{:else}
		<span class="whitespace-pre"> </span>
	{/each}
</div>
