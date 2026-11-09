/*
 * A line is an array of characters, each optionally carrying a chord (plan §6). These turn it into render
 * segments, and to and from the inline bracket syntax (`[G]Amazing [G7]grace`) that paste, ChordPro import
 * and the desktop editor share. Pure.
 */
import type { ChartCharacter, Chord } from '#convex/validators.js';
import { chordToText, parseChord } from './chords';

/* Convex's runtime may lack Intl.Segmenter; code points are the fallback there. */
const graphemeSegmenter =
	typeof Intl !== 'undefined' && 'Segmenter' in Intl
		? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
		: undefined;

/** Graphemes, so accents and emoji stay one character each. */
export function graphemes(text: string) {
	if (!graphemeSegmenter) return [...text];
	return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
}

/** Plain characters, no chords. */
export function toCharacters(text: string): ChartCharacter[] {
	return graphemes(text).map((character) => ({ character }));
}

/** The line's words. */
export function lineText(characters: ChartCharacter[]) {
	return characters.map((c) => c.character).join('');
}

export function hasChords(characters: ChartCharacter[]) {
	return characters.some((c) => c.chord);
}

/** Only spaces (with or without chords): an instrumental line. */
export function isInstrumental(characters: ChartCharacter[]) {
	return characters.every((c) => c.character.trim() === '');
}

export type Segment = {
	/** Index of the segment's first character in the line, a stable key. */
	start: number;
	chord?: Chord;
	text: string;
};

/**
 * Cuts the line at every chord-bearing character. Each segment renders as a two-row column — chord over its
 * syllable — so chords stay glued to their text while lines wrap naturally. §8.
 */
export function segmentCharacters(characters: ChartCharacter[]): Segment[] {
	const segments: Segment[] = [];
	characters.forEach((c, index) => {
		const last = segments.at(-1);
		if (!last || c.chord) segments.push({ start: index, chord: c.chord, text: c.character });
		else last.text += c.character;
	});
	return segments;
}

/** Characters with every chord removed: what the room sees on the live page. */
export function stripChords(characters: ChartCharacter[]): ChartCharacter[] {
	return characters.map((c) => ({ character: c.character }));
}

/**
 * `[G]Amazing [G7]grace` → characters. A chord attaches to the character after it; a chord with nothing
 * after it (end of line, or another chord straight after) gets its own space. Brackets that aren't a chord
 * we can store stay in the text, so nothing typed is lost.
 */
export function parseBracketLine(text: string): ChartCharacter[] {
	const characters: ChartCharacter[] = [];
	let pending: Chord | undefined;
	for (const part of text.split(/(\[[^\]\n]*\])/)) {
		const chord =
			part.startsWith('[') && part.endsWith(']') ? parseChord(part.slice(1, -1)) : undefined;
		if (chord) {
			if (pending) characters.push({ character: ' ', chord: pending });
			pending = chord;
			continue;
		}
		for (const character of graphemes(part)) {
			characters.push(pending ? { character, chord: pending } : { character });
			pending = undefined;
		}
	}
	if (pending) characters.push({ character: ' ', chord: pending });
	return characters;
}

/**
 * The index in parseBracketLine(text) of the character a caret at `offset` sits before. A chord just before
 * the caret belongs to the character after it, so `Amazing [G]|grace` is at the "g"; at the end of the line it
 * stays on its padding space. (Parsing the text before the caret plus one more character puts a pending
 * chord on that character instead of a padding space.)
 */
export function bracketCaretIndex(text: string, offset: number) {
	if (offset >= text.length) return parseBracketLine(text).length;
	return parseBracketLine(text.slice(0, offset) + 'x').length - 1;
}

/** Characters → `[G]Amazing [G7]grace`. The inverse of parseBracketLine. */
export function serializeLine(characters: ChartCharacter[]) {
	return characters
		.map((c, index) => {
			if (!c.chord) return c.character;
			// A trailing chord sits on a padding space that parseBracketLine recreates.
			const isPadding =
				c.character === ' ' && (index === characters.length - 1 || characters[index + 1]?.chord);
			return `[${chordToText(c.chord)}]${isPadding ? '' : c.character}`;
		})
		.join('');
}

/**
 * The line after its words were edited to `text`, with chords kept on their characters. `caret` (in
 * graphemes, after the edit) places the change when the text repeats letters ("aa" → "aaa"). A chord on a
 * deleted character goes with it, unless the character was typed over: then the first new character keeps it.
 */
export function editCharacters(
	old: ChartCharacter[],
	text: string,
	caret: number
): ChartCharacter[] {
	const next = graphemes(text);
	let start = 0;
	while (start < Math.min(old.length, next.length, caret) && old[start]!.character === next[start])
		start++;
	let end = 0;
	const maxEnd = Math.min(old.length - start, next.length - Math.max(start, caret));
	while (end < maxEnd && old[old.length - 1 - end]!.character === next[next.length - 1 - end])
		end++;
	const removed = old.slice(start, old.length - end);
	const inserted: ChartCharacter[] = next
		.slice(start, next.length - end)
		.map((character) => ({ character }));
	if (inserted[0] && removed[0]?.chord) inserted[0].chord = removed[0].chord;
	return [...old.slice(0, start), ...inserted, ...old.slice(old.length - end)];
}

/** The line with `chord` on character `index` (or removed, when undefined). Past the end pads with spaces. */
export function setChordAt(
	characters: ChartCharacter[],
	index: number,
	chord: Chord | undefined
): ChartCharacter[] {
	const next = characters.map((c) => ({ ...c }));
	while (next.length <= index) next.push({ character: ' ' });
	next[index] = chord
		? { character: next[index]!.character, chord }
		: { character: next[index]!.character };
	// A removed trailing chord takes its padding spaces with it.
	if (!chord)
		while (next.length > index && next.at(-1)!.character === ' ' && !next.at(-1)!.chord) next.pop();
	return next;
}
