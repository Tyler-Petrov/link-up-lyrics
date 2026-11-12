/*
 * Pasted text → a song's blocks. Understands inline brackets (`[G]Amazing grace`), chords written on the
 * line above the words, and the common ChordPro directives. Blank lines split blocks; a block's first line
 * is its name when it looks like one ("Chorus", "[Verse 2]", "Bridge:"). Pure.
 */
import type { ChartCharacter } from '#convex/validators.js';
import type { ConstantTag, MusicalKeyTag } from '#convex/constants.js';
import { parseChord, parseKey } from './chords';
import { graphemes, isInstrumental, parseBracketLine, serializeLine } from './lines';

export type ParsedLine = {
	kindTag: ConstantTag<'SongLineKinds'>;
	characters: ChartCharacter[];
	startsGroup?: boolean;
};

export type ParsedBlock = {
	name: string;
	kindTag: ConstantTag<'SongSectionKinds'>;
	lines: ParsedLine[];
	/** Index of an earlier block this one repeats; it then has no lines of its own. */
	repeatOf?: number;
};

export type ParsedSong = {
	title?: string;
	artist?: string;
	keyTag?: MusicalKeyTag;
	capo?: number;
	blocks: ParsedBlock[];
};

const SECTION_WORDS =
	'verse|chorus|refrain|pre-?chorus|bridge|intro|outro|interlude|instrumental|turnaround|tag|ending|coda|vamp|solo';
const headerPattern = new RegExp(
	`^[\\[(]?\\s*((?:${SECTION_WORDS})\\b[^\\])]{0,24}?)\\s*[\\])]?\\s*:?$`,
	'i'
);
const INTERLUDE_NAMES = /^(interlude|instrumental|turnaround|solo|intro|outro)/i;

/** "Chorus", "[Verse 2]", "Bridge:" → the name; otherwise undefined. */
function headerName(line: string) {
	const trimmed = line.trim();
	const match = headerPattern.exec(trimmed);
	if (match) return match[1]!.trim();
	// Any short line ending in a colon, like "Ending (slow):"
	if (/^[^[\]]{1,30}:$/.test(trimmed) && trimmed.split(/\s+/).length <= 4)
		return trimmed.slice(0, -1).trim();
	return undefined;
}

/** A line made only of chords ("G   C/E  D"), as written above the words. */
function isChordRow(line: string) {
	const tokens = line.trim().split(/\s+/);
	return line.trim() !== '' && tokens.every((token) => parseChord(token) !== undefined);
}

/** Chords written above the words, placed by column onto the line below (or onto spaces when alone). */
function mergeChordRow(chordRow: string, lyric: string | undefined): ChartCharacter[] {
	const characters: ChartCharacter[] = (lyric === undefined ? [] : graphemes(lyric)).map(
		(character) => ({
			character
		})
	);
	for (const match of chordRow.matchAll(/\S+/g)) {
		while (characters.length <= match.index) characters.push({ character: ' ' });
		characters[match.index]!.chord = parseChord(match[0]);
	}
	return characters;
}

function parseLines(rawLines: string[]): ParsedLine[] {
	const lines: ParsedLine[] = [];
	for (let i = 0; i < rawLines.length; i++) {
		const raw = rawLines[i]!;
		if (isChordRow(raw)) {
			const next = rawLines[i + 1];
			const pairsWithNext = next !== undefined && !isChordRow(next) && !next.includes('[');
			lines.push({
				kindTag: 'lyric',
				characters: mergeChordRow(raw, pairsWithNext ? next : undefined)
			});
			if (pairsWithNext) i++;
			continue;
		}
		lines.push({ kindTag: 'lyric', characters: parseBracketLine(raw.trimEnd()) });
	}
	return lines;
}

const directivePattern = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;

export function parseSongText(text: string): ParsedSong {
	const song: ParsedSong = { blocks: [] };
	const paragraphs: { name?: string; lines: string[] }[] = [];
	let current: { name?: string; lines: string[] } | undefined;
	const close = () => {
		if (current && (current.lines.length || current.name)) paragraphs.push(current);
		current = undefined;
	};

	for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
		const directive = directivePattern.exec(raw.trim());
		if (directive) {
			const name = directive[1]!.toLowerCase();
			const value = directive[2]?.trim() ?? '';
			if (name === 'title' || name === 't') song.title = value;
			else if (name === 'artist' || name === 'subtitle' || name === 'st') song.artist = value;
			else if (name === 'key') song.keyTag = parseKey(value);
			else if (name === 'capo') song.capo = Number.parseInt(value) || undefined;
			else if (['comment', 'c', 'ci', 'comment_italic'].includes(name)) {
				close();
				current = { name: value, lines: [] };
			} else if (name.startsWith('start_of_') || ['soc', 'sov', 'sob'].includes(name)) {
				close();
				const kind =
					{ soc: 'chorus', sov: 'verse', sob: 'bridge' }[name] ?? name.replace('start_of_', '');
				current = { name: value || kind[0]!.toUpperCase() + kind.slice(1), lines: [] };
			} else if (name.startsWith('end_of_') || ['eoc', 'eov', 'eob'].includes(name)) close();
			continue;
		}
		if (raw.trim() === '') {
			close();
			continue;
		}
		if (!current) {
			const name = headerName(raw);
			current = { name, lines: [] };
			if (name !== undefined) continue;
		}
		current.lines.push(raw);
	}
	close();

	let verseNumber = 0;
	for (const paragraph of paragraphs) {
		const lines = parseLines(paragraph.lines);
		const body = lines.map((line) => serializeLine(line.characters)).join('\n');
		const earlier = song.blocks.findIndex((block, index) => {
			if (block.repeatOf !== undefined) return false;
			const sameName =
				paragraph.name !== undefined && block.name.toLowerCase() === paragraph.name.toLowerCase();
			const earlierBody = song.blocks[index]!.lines.map((line) =>
				serializeLine(line.characters)
			).join('\n');
			return (
				(sameName && (lines.length === 0 || earlierBody === body)) ||
				(lines.length > 0 && earlierBody === body)
			);
		});
		if (earlier !== -1) {
			const source = song.blocks[earlier]!;
			song.blocks.push({
				name: paragraph.name ?? source.name,
				kindTag: source.kindTag,
				lines: [],
				repeatOf: earlier
			});
			continue;
		}
		const isInterlude =
			lines.every((line) => isInstrumental(line.characters)) &&
			(lines.length > 0 || INTERLUDE_NAMES.test(paragraph.name ?? ''));
		let name = paragraph.name ?? (isInterlude ? 'Interlude' : '');
		while (!name || song.blocks.some((block) => block.name === name))
			name = `Verse ${++verseNumber}`;
		song.blocks.push({ name, kindTag: isInterlude ? 'interlude' : 'lyrics', lines });
	}
	return song;
}
