<script lang="ts">
	import { untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import {
		Accidentals,
		ChordQualities,
		ChordRoots,
		constantByTag,
		type ConstantTag
	} from '#convex/constants.js';
	import type { Chord } from '#convex/validators.js';
	import { formatChord } from '#lib/chart/index.js';
	import { cn } from '#lib/utils.js';
	import { getSongEditor } from './editor.svelte.js';

	/*
	 * Root, then only that root's legal accidentals, then a quality: an impossible chord can't be entered.
	 * A bottom sheet on phones, a centred card elsewhere. Native <dialog>, so focus, Escape and the inert
	 * background come free. Plan §10.
	 */
	const editor = getSongEditor();
	const target = $derived(editor.picker);

	let dialog = $state<HTMLDialogElement>();
	let rootTag = $state<ConstantTag<'ChordRoots'>>('g');
	let accidentalTag = $state<ConstantTag<'Accidentals'>>('natural');
	let qualityTag = $state<ConstantTag<'ChordQualities'>>('major');
	/** Kept from the chord being edited: the picker doesn't set a bass note, brackets do. */
	let bass = $state<Pick<Chord, 'bassRootTag' | 'bassAccidentalTag'>>({});

	const existing = $derived(target?.characters[target.index]?.chord);
	const root = $derived(constantByTag('ChordRoots', rootTag));
	const chord = $derived<Chord>({ rootTag, accidentalTag, qualityTag, ...bass });
	/** The line with the target character marked, for context. */
	const context = $derived.by(() => {
		if (!target) return { before: '', at: '', after: '' };
		const text = target.characters.map((c) => c.character);
		while (text.length <= target.index) text.push(' ');
		const from = Math.max(0, target.index - 14);
		const at = text[target.index]!;
		return {
			before: (from > 0 ? '…' : '') + text.slice(from, target.index).join(''),
			at: at === ' ' ? '·' : at,
			after: text.slice(target.index + 1, target.index + 15).join('')
		};
	});

	/** Opens with the target's chord, or the last one picked, so the next chord is a tap or two away. */
	function sync(element: HTMLDialogElement) {
		dialog = element;
		if (!target) return element.close();
		const chord = untrack(() => existing);
		if (chord) {
			rootTag = chord.rootTag;
			accidentalTag = chord.accidentalTag;
			qualityTag = chord.qualityTag;
			bass = { bassRootTag: chord.bassRootTag, bassAccidentalTag: chord.bassAccidentalTag };
		} else bass = {};
		if (!element.open) element.showModal();
	}

	function pickRoot(tag: ConstantTag<'ChordRoots'>) {
		rootTag = tag;
		const allowed = constantByTag('ChordRoots', tag).allowedAccidentals as readonly string[];
		if (!allowed.includes(accidentalTag)) accidentalTag = 'natural';
	}

	function finish(picked: Chord | undefined | 'cancel') {
		if (picked !== 'cancel') target?.onPick(picked);
		editor.picker = null;
	}
</script>

<dialog
	{@attach sync}
	class="chord-picker m-0 mt-auto w-full max-w-none rounded-t-3xl bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
	aria-label="Choose a chord"
	onclose={() => (editor.picker = null)}
	onclick={(event) => {
		if (event.target === dialog) finish('cancel');
	}}
>
	<div class="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
		<header class="flex items-start justify-between gap-3">
			<div class="flex flex-col gap-1">
				<span class="text-4xl font-[750] text-chord tabular-nums" aria-live="polite">
					{formatChord(chord)}
				</span>
				<span class="font-chart text-sm whitespace-pre text-muted-foreground">
					{context.before}<mark class="rounded bg-primary/25 px-0.5 text-foreground"
						>{context.at}</mark
					>{context.after}
				</span>
			</div>
			<button
				type="button"
				class="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label="Close"
				onclick={() => finish('cancel')}
			>
				<X class="size-5" />
			</button>
		</header>

		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Root
			</legend>
			<div class="grid grid-cols-7 gap-1.5">
				{#each ChordRoots as option (option.tag)}
					<button
						type="button"
						class={cn(
							'h-12 rounded-xl text-lg font-bold transition-colors',
							option.tag === rootTag
								? 'bg-primary text-primary-foreground'
								: 'bg-secondary hover:bg-accent'
						)}
						aria-pressed={option.tag === rootTag}
						onclick={() => pickRoot(option.tag)}>{option.name}</button
					>
				{/each}
			</div>
		</fieldset>

		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Accidental
			</legend>
			<div class="grid grid-cols-3 gap-1.5">
				{#each Accidentals as option (option.tag)}
					{@const allowed = (root.allowedAccidentals as readonly string[]).includes(option.tag)}
					<button
						type="button"
						disabled={!allowed}
						class={cn(
							'h-11 rounded-xl text-base font-semibold transition-colors disabled:opacity-25',
							option.tag === accidentalTag
								? 'bg-primary text-primary-foreground'
								: 'bg-secondary enabled:hover:bg-accent'
						)}
						aria-pressed={option.tag === accidentalTag}
						onclick={() => (accidentalTag = option.tag)}
					>
						{option.symbol || '♮'}
						<span class="ml-1 text-xs font-normal opacity-75">{option.name}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Quality
			</legend>
			<div class="grid grid-cols-4 gap-1.5">
				{#each ChordQualities as option (option.tag)}
					<button
						type="button"
						class={cn(
							'flex h-12 flex-col items-center justify-center rounded-xl leading-tight transition-colors',
							option.tag === qualityTag
								? 'bg-primary text-primary-foreground'
								: 'bg-secondary hover:bg-accent'
						)}
						aria-pressed={option.tag === qualityTag}
						title={option.name}
						onclick={() => (qualityTag = option.tag)}
					>
						<span class="font-bold">{option.suffix || 'maj'}</span>
						<span class="w-full truncate px-1 text-[0.65rem] opacity-75">{option.name}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<footer class="flex gap-2">
			{#if existing}
				<button
					type="button"
					class="h-12 rounded-xl px-4 font-semibold text-destructive hover:bg-destructive/10"
					onclick={() => finish(undefined)}>Remove</button
				>
			{/if}
			<button
				type="button"
				class="h-12 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
				onclick={() => finish(chord)}>Set {formatChord(chord)}</button
			>
		</footer>
	</div>
</dialog>

<style>
	/* Slides up as a sheet; fades in as a card from sm up. Native <dialog> + @starting-style. */
	.chord-picker {
		transition:
			translate 220ms cubic-bezier(0.2, 0.9, 0.3, 1),
			opacity 180ms,
			overlay 220ms allow-discrete,
			display 220ms allow-discrete;
		translate: 0 0;
		opacity: 1;
		max-height: 92dvh;
		overflow-y: auto;
	}
	.chord-picker:not([open]) {
		translate: 0 100%;
		opacity: 0;
	}
	@starting-style {
		.chord-picker[open] {
			translate: 0 100%;
			opacity: 0;
		}
	}
	@media (min-width: 40rem) {
		.chord-picker:not([open]) {
			translate: 0 1rem;
		}
		@starting-style {
			.chord-picker[open] {
				translate: 0 1rem;
			}
		}
	}
	.chord-picker::backdrop {
		transition:
			opacity 200ms,
			overlay 200ms allow-discrete,
			display 200ms allow-discrete;
		opacity: 1;
	}
	@starting-style {
		.chord-picker[open]::backdrop {
			opacity: 0;
		}
	}
</style>
