<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import type { MusicalKeyTag } from '#convex/constants.js';
	import { keyName, transposeKey } from '#lib/chart/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	/** Semitones up (positive) or down, kept within an octave. Shows the resulting key when the song has one. */
	let { semitones = $bindable(0), keyTag }: { semitones?: number; keyTag?: MusicalKeyTag } =
		$props();

	const shift = (by: number) => (semitones = ((((semitones + by + 6) % 12) + 12) % 12) - 6);
	const label = $derived(
		keyTag
			? keyName(transposeKey(keyTag, semitones).tag)
			: semitones === 0
				? 'Original'
				: `${semitones > 0 ? '+' : ''}${semitones}`
	);
</script>

<div
	class="inline-flex items-center gap-1 rounded-xl bg-card p-1 shadow-sm"
	role="group"
	aria-label="Transpose"
>
	<Button
		variant="ghost"
		size="icon"
		class="rounded-lg"
		onclick={() => shift(-1)}
		aria-label="Down a semitone"
	>
		<Minus />
	</Button>
	<button
		type="button"
		class="min-w-20 rounded-lg px-2 py-1 text-center text-sm font-semibold tabular-nums hover:bg-accent"
		title="Back to the original key"
		onclick={() => (semitones = 0)}
	>
		{label}
		{#if keyTag && semitones !== 0}
			<span class="text-xs font-normal text-muted-foreground"
				>({semitones > 0 ? '+' : ''}{semitones})</span
			>
		{/if}
	</button>
	<Button
		variant="ghost"
		size="icon"
		class="rounded-lg"
		onclick={() => shift(1)}
		aria-label="Up a semitone"
	>
		<Plus />
	</Button>
</div>
