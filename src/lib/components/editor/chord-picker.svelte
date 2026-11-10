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
	import { reduced, reveal } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import { Advanced } from '#lib/components/ui/advanced/index.js';
	import { getSongEditor } from './editor.svelte.js';

	/*
	 * Root, then only that root's legal accidentals, then a quality, then optionally a bass note for a slash
	 * chord (G/B), again with only its legal accidentals: an impossible chord can't be entered. A bottom sheet
	 * on phones; elsewhere a card hung from near the top, so opening More grows it downward and what you just
	 * pressed stays under the pointer. Set stays in view below the choices, which scroll when they don't fit.
	 * Native <dialog>, so focus, Escape and the inert background come free. Plan §10.
	 */
	const editor = getSongEditor();
	const target = $derived(editor.picker);

	let dialog = $state<HTMLDialogElement>();
	let rootTag = $state<ConstantTag<'ChordRoots'>>('g');
	let accidentalTag = $state<ConstantTag<'Accidentals'>>('natural');
	let qualityTag = $state<ConstantTag<'ChordQualities'>>('major');
	/** The slash chord's bass note; none for most chords. */
	let bassRootTag = $state<ConstantTag<'ChordRoots'>>();
	let bassAccidentalTag = $state<ConstantTag<'Accidentals'>>('natural');

	/** What most charts use. The rest, and slash basses, wait under "More chords". */
	const common: ConstantTag<'ChordQualities'>[] = [
		'major',
		'minor',
		'dominant7',
		'major7',
		'minor7',
		'sus2',
		'sus4',
		'add9'
	];
	const commonQualities = ChordQualities.filter((q) => common.includes(q.tag));
	const moreQualities = ChordQualities.filter((q) => !common.includes(q.tag));
	/** Opens with the picker when the chord already uses something from it. */
	let more = $state(false);

	const existing = $derived(target?.characters[target.index]?.chord);
	const isNoChord = $derived(qualityTag === 'noChord');
	const chord = $derived<Chord>(
		bassRootTag && !isNoChord
			? { rootTag, accidentalTag, qualityTag, bassRootTag, bassAccidentalTag }
			: { rootTag, accidentalTag, qualityTag }
	);

	const allows = (rootTag: ConstantTag<'ChordRoots'>, accidentalTag: string) =>
		(constantByTag('ChordRoots', rootTag).allowedAccidentals as readonly string[]).includes(
			accidentalTag
		);
	/** Up to 14 characters from the target outwards, cut between words, with … where the line goes on. */
	function excerpt(characters: string[]) {
		if (characters.length <= 14) return characters;
		const space = characters.lastIndexOf(' ', 14);
		return [...characters.slice(0, space > 0 ? space : 14), '…'];
	}
	/** The line with the target character marked, for context. */
	const context = $derived.by(() => {
		if (!target) return { before: '', at: '', after: '' };
		const text = target.characters.map((c) => c.character);
		while (text.length <= target.index) text.push(' ');
		const at = text[target.index]!;
		return {
			before: excerpt(text.slice(0, target.index).reverse()).reverse().join(''),
			at: at === ' ' ? '·' : at,
			after: excerpt(text.slice(target.index + 1)).join('')
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
			bassRootTag = chord.bassRootTag;
			bassAccidentalTag = chord.bassAccidentalTag ?? 'natural';
		} else bassRootTag = undefined;
		more = untrack(() => !common.includes(qualityTag) || !!bassRootTag);
		if (!element.open) element.showModal();
	}

	function pickRoot(tag: ConstantTag<'ChordRoots'>) {
		rootTag = tag;
		if (!allows(tag, accidentalTag)) accidentalTag = 'natural';
	}

	function pickBass(tag: ConstantTag<'ChordRoots'> | undefined) {
		bassRootTag = tag;
		if (tag && !allows(tag, bassAccidentalTag)) bassAccidentalTag = 'natural';
	}

	function finish(picked: Chord | undefined | 'cancel') {
		if (picked !== 'cancel') target?.onPick(picked);
		editor.picker = null;
	}
</script>

<dialog
	{@attach sync}
	class="chord-picker m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/50 sm:mx-auto sm:mt-[12vh] sm:max-h-[calc(88dvh-1.5rem)] sm:max-w-md sm:rounded-3xl"
	aria-label="Choose a chord"
	onclose={() => (editor.picker = null)}
	onclick={(event) => {
		if (event.target === dialog) finish('cancel');
	}}
>
	<!-- The chord and the line stay in view at the top, as Set does at the bottom; the choices scroll between. -->
	<div class="flex max-h-[inherit] flex-col">
		<header class="flex items-start justify-between gap-3 p-5 pb-3">
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

		<div class="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-2 pb-2">
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
						<button
							type="button"
							disabled={!allows(rootTag, option.tag)}
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

			{#snippet qualities(options: (typeof ChordQualities)[number][])}
				<div class="grid grid-cols-4 gap-1.5">
					{#each options as option (option.tag)}
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
							<span class="w-full px-1 text-[0.65rem] text-balance opacity-75">{option.name}</span>
						</button>
					{/each}
				</div>
			{/snippet}

			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Quality
				</legend>
				{@render qualities(commonQualities)}
			</fieldset>

			<Advanced label="More chords and bass notes" bind:open={more} class="-mt-2">
				{@render qualities(moreQualities)}

				<fieldset class="flex flex-col pt-2 disabled:opacity-40" disabled={isNoChord}>
					<legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Bass note <span class="font-normal normal-case"
							>(optional, for a slash chord like G/B)</span
						>
					</legend>
					<!-- None is as wide as its word needs; the seven notes share the rest. -->
					<div class="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1.5">
						<button
							type="button"
							class={cn(
								'h-10 rounded-xl px-3 text-xs font-semibold transition-colors',
								!bassRootTag
									? 'bg-primary text-primary-foreground'
									: 'bg-secondary enabled:hover:bg-accent'
							)}
							aria-pressed={!bassRootTag}
							onclick={() => pickBass(undefined)}>None</button
						>
						{#each ChordRoots as option (option.tag)}
							<button
								type="button"
								class={cn(
									'h-10 rounded-xl text-base font-bold transition-colors',
									option.tag === bassRootTag
										? 'bg-primary text-primary-foreground'
										: 'bg-secondary enabled:hover:bg-accent'
								)}
								aria-pressed={option.tag === bassRootTag}
								aria-label="Bass {option.name}"
								onclick={() => pickBass(option.tag)}>{option.name}</button
							>
						{/each}
					</div>
					{#if bassRootTag}
						{@const bassRoot = bassRootTag}
						<!-- Its gap is padding, so it slides open and shut with the row. Once open, it's scrolled into
						     view when the choices are taller than the screen. -->
						<div
							class="grid grid-cols-3 gap-1.5 pt-2"
							transition:reveal
							onintroend={(event) =>
								event.currentTarget.scrollIntoView({
									block: 'nearest',
									behavior: reduced() ? 'instant' : 'smooth'
								})}
						>
							{#each Accidentals as option (option.tag)}
								<button
									type="button"
									disabled={!allows(bassRoot, option.tag)}
									class={cn(
										'h-9 rounded-xl text-sm font-semibold transition-colors disabled:opacity-25',
										option.tag === bassAccidentalTag
											? 'bg-primary text-primary-foreground'
											: 'bg-secondary enabled:hover:bg-accent'
									)}
									aria-pressed={option.tag === bassAccidentalTag}
									aria-label="Bass {option.name}"
									onclick={() => (bassAccidentalTag = option.tag)}
								>
									{option.symbol || '♮'}
								</button>
							{/each}
						</div>
					{/if}
				</fieldset>
			</Advanced>
		</div>

		<footer class="flex gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
