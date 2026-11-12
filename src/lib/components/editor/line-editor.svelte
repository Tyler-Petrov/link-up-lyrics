<script lang="ts">
	import { onDestroy } from 'svelte';
	import { on } from 'svelte/events';
	import X from '@lucide/svelte/icons/x';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import type { ChartCharacter } from '#convex/validators.js';
	import {
		bracketCaretIndex,
		editCharacters,
		formatChord,
		graphemes,
		lineText,
		parseBracketLine,
		serializeLine,
		setChordAt
	} from '#convex/shared/chart/index.js';
	import { reduced } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import { getSongEditor } from './editor.svelte.js';

	/*
	 * One editable line. Two input methods over the same characters (plan §10.1):
	 *  - picker: the words in a plain input, with a chord lane above. Tap above a letter to put a chord on it;
	 *    typing keeps every chord on its character.
	 *  - brackets: `[G]Amazing [G7]grace` in a plain input, parsed back into characters.
	 * Enter splits the line, Backspace at its start joins it to the line above, a multi-line paste makes lines.
	 */
	type Props = {
		line: Doc<'SongLine'>;
		/** The line above in the same block, which Backspace at the start joins onto. */
		previous?: Doc<'SongLine'>;
		/** The line below in the same block, which starts the group in this one's place if it's deleted. */
		next?: Doc<'SongLine'>;
		/** A line in an interlude: chords only, so the picker shows just the lane. */
		chordsOnly?: boolean;
	};
	let { line, previous, next, chordsOnly = false }: Props = $props();

	const editor = getSongEditor();
	const mode = $derived(editor.mode);

	let input = $state<HTMLInputElement>();
	/* While focused, the unsaved edit. Brackets keep the raw text, so a half-typed `[G` isn't reparsed away. */
	let draftCharacters = $state.raw<ChartCharacter[] | null>(null);
	let draftText = $state<string | null>(null);
	const characters = $derived(draftCharacters ?? line.characters);
	const value = $derived(
		mode === 'brackets' ? (draftText ?? serializeLine(line.characters)) : lineText(characters)
	);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	/* The edit waiting on the timer. Plain, not $state: an unmount's teardown reads state as of before the
	   last flush, which could miss the final keystroke. */
	let unsaved: ChartCharacter[] | null = null;

	function edited(): ChartCharacter[] {
		return mode === 'brackets' && draftText !== null ? parseBracketLine(draftText) : characters;
	}

	function flush() {
		clearTimeout(saveTimer);
		editor.drafts.delete(line._id);
		if (!unsaved) return;
		const characters = unsaved;
		unsaved = null;
		return editor.setCharacters(line._id, characters);
	}

	function oninput() {
		if (!input) return;
		if (mode === 'brackets') draftText = input.value;
		else {
			const caret = graphemes(
				input.value.slice(0, input.selectionEnd ?? input.value.length)
			).length;
			draftCharacters = editCharacters(characters, input.value, caret);
		}
		unsaved = edited();
		editor.drafts.add(line._id);
		clearTimeout(saveTimer);
		saveTimer = setTimeout(flush, 600);
	}

	/* A line removed or left while its save is pending still saves. */
	onDestroy(flush);

	function onblur() {
		void flush();
		draftCharacters = null;
		draftText = null;
		// As a plain input does, a line you leave shows its start again. Not in picker mode: tapping a chord there
		// takes the focus too, and the line should stay where it is.
		if (mode === 'brackets')
			input?.parentElement?.scrollTo({ left: 0, behavior: reduced() ? 'instant' : 'smooth' });
	}

	/** The line cut at the selection (which is dropped), in characters. */
	function split(): [ChartCharacter[], ChartCharacter[]] {
		const text = input!.value;
		const start = input!.selectionStart ?? text.length;
		const end = input!.selectionEnd ?? start;
		const all = mode === 'brackets' ? parseBracketLine(text) : characters;
		const at = (offset: number) =>
			mode === 'brackets'
				? bracketCaretIndex(text, offset)
				: graphemes(text.slice(0, offset)).length;
		return [all.slice(0, at(start)), all.slice(at(end))];
	}

	/** Where the caret goes after `characters`, in this input's units. */
	const caretAfter = (characters: ChartCharacter[]) =>
		mode === 'brackets' ? serializeLine(characters).length : lineText(characters).length;

	async function replaceWith(lines: ChartCharacter[][], focusIndex: number, caret: number) {
		clearTimeout(saveTimer);
		editor.drafts.delete(line._id);
		unsaved = null;
		draftCharacters = mode === 'brackets' ? null : lines[0]!;
		draftText = mode === 'brackets' ? serializeLine(lines[0]!) : null;
		await editor.changeLines(async () => {
			const ids = await editor.replaceLine(line._id, lines);
			return ids && { lineId: ids[focusIndex - 1] ?? line._id, caret };
		});
	}

	/* Until the line a split or join is for has focus, typing would land on this one: keep it for that line. */
	function onbeforeinput(event: InputEvent) {
		if (!editor.linesChanging) return;
		event.preventDefault();
		if (event.inputType === 'insertText' && event.data) editor.held += event.data;
	}

	async function onkeydown(event: KeyboardEvent) {
		if (!input) return;
		if (editor.linesChanging) {
			if (event.key === 'Enter' || event.key === 'Backspace') event.preventDefault();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			await replaceWith(split(), 1, 0);
		} else if (
			event.key === 'Backspace' &&
			previous &&
			input.selectionStart === 0 &&
			input.selectionEnd === 0
		) {
			event.preventDefault();
			const joined = [...previous.characters, ...edited()];
			const caret = caretAfter(previous.characters);
			void flush(); // mutations run in order, so the join sees this line's latest words
			// The line above shows the join straight away (this one leaves as it does), so focus moves there now
			// and typing carries on in it while the join saves.
			const lineId = previous._id;
			void editor.mergeLineUp(line._id, lineId, joined);
			await editor.changeLines(async () => ({ lineId, caret, characters: joined }));
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-line-input]')];
			const target = inputs[inputs.indexOf(input) + (event.key === 'ArrowUp' ? -1 : 1)];
			if (!target) return;
			event.preventDefault();
			const caret = Math.min(input.selectionStart ?? 0, target.value.length);
			target.focus();
			target.setSelectionRange(caret, caret);
		}
	}

	async function onpaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text/plain');
		if (!text || !/[\r\n]/.test(text)) return;
		event.preventDefault();
		if (editor.linesChanging) return;
		const pasted = text
			.replace(/\r\n?/g, '\n')
			.replace(/\n$/, '')
			.split('\n')
			.map(parseBracketLine);
		const [before, after] = split();
		const last = pasted.at(-1)!;
		const lines = pasted.map((characters, index) => [
			...(index === 0 ? before : []),
			...characters,
			...(index === pasted.length - 1 ? after : [])
		]);
		await replaceWith(
			lines,
			lines.length - 1,
			caretAfter(pasted.length === 1 ? [...before, ...last] : last)
		);
	}

	/* Focus requests: the new line after Enter or paste, the line above after Backspace. */
	$effect(() => {
		const request = editor.focusRequest;
		if (request?.lineId !== line._id || !input) return;
		if (request.characters) {
			draftCharacters = mode === 'brackets' ? null : request.characters;
			draftText = mode === 'brackets' ? serializeLine(request.characters) : null;
			input.value = draftText ?? lineText(request.characters);
		}
		input.focus();
		input.setSelectionRange(request.caret, request.caret);
		// What was typed while the line was being made, typed in for real.
		const held = editor.focused();
		if (held) {
			input.setRangeText(held, request.caret, request.caret, 'end');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});

	/* ---------- The chord lane (picker mode) ---------- */

	const slots = $derived(Math.max(characters.length + 4, chordsOnly ? 24 : 8));
	/** Each character's chord label, if it has one. */
	const labels = $derived(characters.map((c) => c.chord && formatChord(c.chord)));
	/**
	 * How much of the lane a label takes, in ch: a label letter is 0.78ch of the words' (xs under base, sm under lg,
	 * one monospace font), plus half a letter to keep labels apart.
	 */
	const labelSpan = (label: string) => (label.length + 0.5) * 0.78;
	/**
	 * Where each character's slot starts, in ch: one after another, except that on an interlude's line a chord
	 * sits at least 4ch (or its label) after the one before, as ChartLine spaces them, so `[D][G][A][D]` doesn't
	 * run together.
	 */
	const slotStarts = $derived.by(() => {
		const starts: number[] = [];
		let free = -Infinity;
		for (let index = 0; index < slots; index++) {
			const next = index ? starts[index - 1]! + 1 : 0;
			const spaced = chordsOnly && labels[index];
			starts.push(spaced ? Math.max(next, free) : next);
			if (spaced) free = starts[index]! + Math.max(4, labelSpan(spaced));
		}
		return starts;
	});
	const laneWidth = $derived(slotStarts.at(-1)! + 1);
	/**
	 * Each chord and its row in the lane: the one by the words, or the lowest row above where its label won't run
	 * into the chord before it (`Em/B` two letters before `G`), so every chord reads and has its own tap target.
	 * The words stay as typed; only the lane grows, on the lines that need it.
	 */
	const chords = $derived.by(() => {
		const rowEnds: number[] = [];
		return labels.flatMap((label, index) => {
			if (!label) return [];
			const start = slotStarts[index]!;
			const free = rowEnds.findIndex((end) => end <= start);
			const row = free < 0 ? rowEnds.length : free;
			rowEnds[row] = start + labelSpan(label);
			return [{ index, label, row }];
		});
	});
	const laneRows = $derived(Math.max(1, ...chords.map((chord) => chord.row + 1)));

	function openPicker(index: number) {
		editor.picker = {
			characters: line.characters,
			index,
			onPick: (chord) =>
				void editor.setCharacters(line._id, setChordAt(line.characters, index, chord))
		};
	}

	/*
	 * A touch browser nudges a near-miss tap onto something tappable nearby, but only counts an element with its
	 * own click listener (not delegated, as onclick is) and passes over one holding other tappable things. So the
	 * lane's taps go to a layer of their own under the chords, and all of the lane catches a thumb aimed at it.
	 */
	const laneClicks = (layer: HTMLElement) =>
		on(layer, 'click', (event) => {
			const rect = layer.getBoundingClientRect();
			const at = ((event.clientX - rect.left) / rect.width) * laneWidth;
			openPicker(slotStarts.findLastIndex((start) => start <= at));
		});

	/* Shared by each mode and the stand-in shown until the mode is known, so the switch changes nothing. */
	/** A long line scrolls sideways; each edge fades while there's more to see past it. */
	const scroller = 'min-w-0 flex-1 scroll-fade overflow-x-auto overscroll-x-contain';
	const pickerRow = 'w-max min-w-full font-chart text-base leading-snug sm:text-lg';
	/*
	 * --rows rows of chords (one, unless chords would run together), each taller on touch screens, so a thumb aimed
	 * above a letter lands in the lane and not in the words. A tick per slot shows where chords go, but only on the
	 * line being edited (and under a mouse), so the song reads as words.
	 */
	const lane =
		'relative h-[calc(var(--lane-row)*var(--rows))] rounded-md transition-[height] [--lane-row:1.5rem] pointer-coarse:[--lane-row:2.25rem] before:absolute before:inset-0 before:rounded-md before:bg-[repeating-linear-gradient(90deg,transparent_0_calc(1ch-1px),color-mix(in_oklab,var(--chord)_8%,transparent)_calc(1ch-1px)_1ch)] before:opacity-0 before:transition-opacity group-focus-within/line:before:opacity-100 pointer-fine:group-hover/line:before:opacity-100';
	/*
	 * In its --row. On touch as tall as the row, with the chord at its foot, and at least two letters wide, so a
	 * chord is as easy to tap again and a thumb a little off it changes it rather than adding one beside it.
	 */
	const chordPlace =
		'absolute bottom-[calc(var(--lane-row)*var(--row))] flex items-end rounded-md px-0.5 text-left leading-tight transition-[bottom] pointer-coarse:h-(--lane-row) pointer-coarse:min-w-[2ch]';
	const chordLabel = 'text-xs font-bold whitespace-nowrap text-chord sm:text-sm';
	const words = $derived(
		cn('px-0 py-0.5', line.kindTag === 'comment' && 'text-muted-foreground italic')
	);
	const bracketWords = $derived(
		cn(
			'px-2 py-1.5 font-chart text-base',
			line.kindTag === 'comment' && 'text-muted-foreground italic'
		)
	);
</script>

<div class="group/line flex min-w-0 flex-1 items-end gap-1">
	{#if !mode}
		<!-- Until the mode is known (the server render, and hydrating): the line as this kind of screen's default
		     mode shows it, chords and all, so the switch to the real one changes nothing. -->
		<div class={cn(scroller, 'pointer-coarse:hidden')}>
			<p class={cn(bracketWords, 'whitespace-pre')}>{serializeLine(line.characters) || ' '}</p>
		</div>
		<div class={cn(scroller, 'pointer-fine:hidden')}>
			<div class={pickerRow}>
				<div class={lane} style:width="{laneWidth}ch" style:--rows={laneRows}>
					{#each chords as chord (chord.index)}
						<span
							class={chordPlace}
							style:left="{slotStarts[chord.index]}ch"
							style:--row={chord.row}><span class={chordLabel}>{chord.label}</span></span
						>
					{/each}
				</div>
				{#if !chordsOnly}
					<p class={cn(words, 'whitespace-pre')}>{lineText(line.characters) || ' '}</p>
				{/if}
			</div>
		</div>
	{:else if mode === 'picker'}
		<div class={cn(scroller, '[scrollbar-width:thin]')}>
			<div class={pickerRow}>
				<!-- The lane: one invisible slot per character (and a few past the end, for trailing chords). -->
				<div class={lane} style:width="{laneWidth}ch" style:--rows={laneRows}>
					<div
						class="absolute inset-0 cursor-pointer rounded-md transition-colors hover:bg-chord/5"
						{@attach laneClicks}
						title="Tap above a letter to put a chord on it"
					></div>
					{#each chords as chord (chord.index)}
						<button
							type="button"
							class={cn(chordPlace, 'hover:bg-chord/15 focus-visible:bg-chord/15')}
							style:left="{slotStarts[chord.index]}ch"
							style:--row={chord.row}
							onclick={() => openPicker(chord.index)}
							aria-label="Change chord {chord.label}"
						>
							<span class={chordLabel}>{chord.label}</span>
						</button>
					{/each}
				</div>
				{#if !chordsOnly}
					<input
						bind:this={input}
						data-line-input
						{value}
						{oninput}
						{onblur}
						{onbeforeinput}
						{onkeydown}
						{onpaste}
						class={cn(
							words,
							'block w-full rounded-md bg-transparent outline-none placeholder:text-muted-foreground/50 focus:bg-foreground/5'
						)}
						style:min-width="{slots}ch"
						placeholder="Type the words…"
						aria-label="Line words"
						autocomplete="off"
						spellcheck="true"
					/>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Monospace, so the input is as wide as its text and the row scrolls and fades as in picker mode. -->
		<div class={cn(scroller, '[scrollbar-width:none]')}>
			<input
				bind:this={input}
				data-line-input
				{value}
				{oninput}
				{onblur}
				{onbeforeinput}
				{onkeydown}
				{onpaste}
				class={cn(
					bracketWords,
					'block min-w-full rounded-lg bg-transparent outline-none placeholder:text-muted-foreground/50 focus:bg-foreground/5'
				)}
				style:width="calc({value.length + 1}ch + 1rem)"
				placeholder={chordsOnly ? '[G]    [C]    [D]' : '[G]Amazing [G7]grace'}
				aria-label="Line with chords in brackets"
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
	{/if}
	<!-- Shown on hover, or for the line being edited. On touch it takes no room until then, so the words
	     get the width (and a stray tap can't delete another line). -->
	<button
		type="button"
		class="mb-0.5 w-7 shrink-0 overflow-hidden rounded-lg p-1.5 text-muted-foreground opacity-0 transition-[opacity,width,padding] group-focus-within/line:opacity-100 group-hover/line:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 pointer-coarse:w-0 pointer-coarse:px-0 pointer-coarse:group-focus-within/line:w-7 pointer-coarse:group-focus-within/line:px-1.5"
		aria-label="Delete line"
		title="Delete line"
		onclick={() => editor.removeLine(line, next)}
	>
		<X class="size-4" />
	</button>
</div>

<style>
	/*
	 * Scroll-driven: no animation (so no fade) when the line fits. The right edge fades until scrolled to the end,
	 * the left one once scrolled from the start, so a line left scrolled doesn't look as if it starts mid-word.
	 */
	@property --fade {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@property --fade-start {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	.scroll-fade {
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 var(--fade-start),
			#000 calc(100% - var(--fade)),
			transparent
		);
		animation: scroll-fade linear both;
		animation-timeline: scroll(self inline);
	}
	@keyframes scroll-fade {
		0% {
			--fade-start: 0px;
			--fade: 2rem;
		}
		10%,
		90% {
			--fade-start: 2rem;
			--fade: 2rem;
		}
		100% {
			--fade-start: 2rem;
			--fade: 0px;
		}
	}
</style>
