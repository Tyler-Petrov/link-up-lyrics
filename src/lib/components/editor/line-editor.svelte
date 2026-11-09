<script lang="ts">
	import { onDestroy } from 'svelte';
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
	} from '#lib/chart/index.js';
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
	const chords = $derived(
		characters.flatMap((c, index) => (c.chord ? [{ index, label: formatChord(c.chord) }] : []))
	);

	function openPicker(index: number) {
		editor.picker = {
			characters: line.characters,
			index,
			onPick: (chord) =>
				void editor.setCharacters(line._id, setChordAt(line.characters, index, chord))
		};
	}

	function onLaneClick(event: MouseEvent) {
		const lane = event.currentTarget as HTMLElement;
		const rect = lane.getBoundingClientRect();
		openPicker(Math.floor((event.clientX - rect.left) / (rect.width / slots)));
	}
</script>

<div class="group/line flex min-w-0 flex-1 items-end gap-1">
	{#if !mode}
		<!-- Until the mode is known: the words, as tall as the default mode's row on this kind of screen. -->
		<p
			class={cn(
				'min-h-9 min-w-0 flex-1 truncate px-2 py-1.5 font-chart text-base',
				!chordsOnly &&
					'pointer-coarse:min-h-[calc(1.75rem+1.375em)] pointer-coarse:px-0 pointer-coarse:pt-[1.625rem] pointer-coarse:pb-0.5 pointer-coarse:leading-snug sm:pointer-coarse:text-lg'
			)}
		>
			{lineText(line.characters)}
		</p>
	{:else if mode === 'picker'}
		<!-- A long line scrolls sideways; its right edge fades while there's more to see. -->
		<div
			class="min-w-0 flex-1 scroll-fade [scrollbar-width:thin] overflow-x-auto overscroll-x-contain"
		>
			<div class="w-max min-w-full font-chart text-base leading-snug sm:text-lg">
				<!-- The lane: one invisible slot per character (and a few past the end, for trailing chords). -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class="relative h-6 cursor-pointer rounded-md bg-[repeating-linear-gradient(90deg,transparent_0_calc(1ch-1px),color-mix(in_oklab,var(--chord)_8%,transparent)_calc(1ch-1px)_1ch)] transition-colors hover:bg-chord/5"
					style:width="{slots}ch"
					onclick={onLaneClick}
					title="Tap above a letter to put a chord on it"
				>
					{#each chords as chord (chord.index)}
						<button
							type="button"
							class="absolute bottom-0 rounded-md px-0.5 text-left leading-tight hover:bg-chord/15 focus-visible:bg-chord/15"
							style:left="{chord.index}ch"
							onclick={(event) => {
								event.stopPropagation();
								openPicker(chord.index);
							}}
							aria-label="Change chord {chord.label}"
						>
							<span class="text-xs font-bold whitespace-nowrap text-chord sm:text-sm"
								>{chord.label}</span
							>
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
							'block w-full rounded-md bg-transparent px-0 py-0.5 outline-none placeholder:text-muted-foreground/50 focus:bg-foreground/5',
							line.kindTag === 'comment' && 'text-muted-foreground italic'
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
				'block min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 font-chart text-base outline-none placeholder:text-muted-foreground/50 focus:bg-foreground/5',
				line.kindTag === 'comment' && 'text-muted-foreground italic'
			)}
			placeholder={chordsOnly ? '[G]    [C]    [D]' : '[G]Amazing [G7]grace'}
			aria-label="Line with chords in brackets"
			autocomplete="off"
			spellcheck="false"
		/>
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
	/* Scroll-driven: no animation (so no fade) when the line fits; the fade goes once scrolled to the end. */
	@property --fade {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	.scroll-fade {
		mask-image: linear-gradient(to left, transparent, #000 var(--fade));
		animation: scroll-fade linear both;
		animation-timeline: scroll(self inline);
	}
	@keyframes scroll-fade {
		0%,
		90% {
			--fade: 2rem;
		}
		100% {
			--fade: 0px;
		}
	}
</style>
