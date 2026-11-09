<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import type { ChartCharacter } from '#convex/validators.js';
	import {
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
		/** A line in an interlude: chords only, so the picker shows just the lane. */
		chordsOnly?: boolean;
	};
	let { line, previous, chordsOnly = false }: Props = $props();

	const editor = getSongEditor();
	const mode = $derived(editor.mode.current);

	let input = $state<HTMLInputElement>();
	/* While focused, the unsaved edit. Brackets keep the raw text, so a half-typed `[G` isn't reparsed away. */
	let draftCharacters = $state.raw<ChartCharacter[] | null>(null);
	let draftText = $state<string | null>(null);
	const characters = $derived(draftCharacters ?? line.characters);
	const value = $derived(
		mode === 'brackets' ? (draftText ?? serializeLine(line.characters)) : lineText(characters)
	);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;

	function edited(): ChartCharacter[] {
		return mode === 'brackets' && draftText !== null ? parseBracketLine(draftText) : characters;
	}

	function flush() {
		clearTimeout(saveTimer);
		if (!dirty) return;
		dirty = false;
		return editor.setCharacters(line._id, edited());
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
		dirty = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(flush, 600);
	}

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
		if (mode === 'brackets')
			return [parseBracketLine(text.slice(0, start)), parseBracketLine(text.slice(end))];
		const at = (offset: number) => graphemes(text.slice(0, offset)).length;
		return [characters.slice(0, at(start)), characters.slice(at(end))];
	}

	/** Where the caret goes after `characters`, in this input's units. */
	const caretAfter = (characters: ChartCharacter[]) =>
		mode === 'brackets' ? serializeLine(characters).length : lineText(characters).length;

	async function replaceWith(lines: ChartCharacter[][], focusIndex: number, caret: number) {
		clearTimeout(saveTimer);
		dirty = false;
		draftCharacters = mode === 'brackets' ? null : lines[0]!;
		draftText = mode === 'brackets' ? serializeLine(lines[0]!) : null;
		const ids = await editor.replaceLine(line._id, lines);
		await editor.focusLine(ids[focusIndex - 1] ?? line._id, caret);
	}

	async function onkeydown(event: KeyboardEvent) {
		if (!input) return;
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
			// This line is gone once the merge lands, so read its props first.
			const previousId = previous._id;
			await editor.mergeLineUp(line._id, previousId, joined);
			await editor.focusLine(previousId, caret);
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-line-input]')];
			const next = inputs[inputs.indexOf(input) + (event.key === 'ArrowUp' ? -1 : 1)];
			if (!next) return;
			event.preventDefault();
			const caret = Math.min(input.selectionStart ?? 0, next.value.length);
			next.focus();
			next.setSelectionRange(caret, caret);
		}
	}

	async function onpaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text/plain');
		if (!text || !/[\r\n]/.test(text)) return;
		event.preventDefault();
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
		input.focus();
		input.setSelectionRange(request.caret, request.caret);
		editor.focusRequest = null;
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
	{#if mode === 'picker'}
		<div class="min-w-0 flex-1 [scrollbar-width:thin] overflow-x-auto overscroll-x-contain">
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
	<button
		type="button"
		class="mb-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity group-focus-within/line:opacity-100 group-hover/line:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-50"
		aria-label="Delete line"
		onclick={() => editor.removeLine(line._id)}
	>
		<X class="size-4" />
	</button>
</div>
