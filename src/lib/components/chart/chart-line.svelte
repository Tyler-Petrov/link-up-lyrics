<script lang="ts">
	import type { Spelling } from '#convex/constants.js';
	import type { ChartCharacter } from '#convex/validators.js';
	import { formatChord, segmentCharacters } from '#lib/chart/index.js';
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

	// One two-row column per chord: the chord stays glued to its syllable while the line wraps. Plan §8.
	const segments = $derived(segmentCharacters(characters));
</script>

<div class={cn('flex flex-wrap items-end font-chart text-lg leading-snug', className)}>
	{#each segments as segment (segment.start)}
		{@const label =
			showChords && segment.chord ? formatChord(segment.chord, semitones, spelling) : undefined}
		<!-- A chord over nothing but space (an instrumental line) gets room so chords don't run together. -->
		<span
			class={cn(
				'inline-flex flex-col whitespace-pre',
				label && !segment.text.trim() && 'min-w-[4ch]'
			)}
		>
			{#if showChords}
				<span class={cn('pr-[0.5ch] text-sm font-bold text-chord', !label && 'invisible')}
					>{label ?? ' '}</span
				>
			{/if}
			<span>{segment.text}</span>
		</span>
	{:else}
		<span class="whitespace-pre"> </span>
	{/each}
</div>
