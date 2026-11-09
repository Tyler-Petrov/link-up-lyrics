/*
 * Chord spelling and transposition. Pure: no Convex runtime import, runs in the browser and in Convex
 * functions alike. A chord stores root + accidental + quality, so transposing is semitone arithmetic. §8.
 */
import {
	ChordQualities,
	ChordRoots,
	KeyModes,
	MusicalKeys,
	constantByTag,
	type ConstantTag,
	type MusicalKeyTag,
	type Spelling
} from '#convex/constants.js';
import type { Chord } from '#convex/validators.js';

type RootTag = ConstantTag<'ChordRoots'>;
type AccidentalTag = ConstantTag<'Accidentals'>;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** 0–11, C = 0. */
export function pitchClass(rootTag: RootTag, accidentalTag: AccidentalTag) {
	return mod12(
		constantByTag('ChordRoots', rootTag).semitones +
			constantByTag('Accidentals', accidentalTag).semitones
	);
}

/** The root + accidental that spells a pitch class, preferring sharps or flats. Always a legal spelling. */
export function spellPitchClass(pc: number, spelling: Spelling = 'sharp') {
	pc = mod12(pc);
	const natural = ChordRoots.find((root) => root.semitones === pc);
	if (natural) return { rootTag: natural.tag, accidentalTag: 'natural' as AccidentalTag };
	const accidentalTag: AccidentalTag = spelling;
	const shift = constantByTag('Accidentals', accidentalTag).semitones;
	const root = ChordRoots.find((r) => mod12(r.semitones + shift) === pc)!;
	return { rootTag: root.tag, accidentalTag };
}

function noteName(rootTag: RootTag, accidentalTag: AccidentalTag) {
	return (
		constantByTag('ChordRoots', rootTag).name + constantByTag('Accidentals', accidentalTag).symbol
	);
}

/** The sharps-or-flats preference for a key: flat keys (F, B♭, Dm, Cm…) use flats. §5.2. */
export function keySpelling(keyTag: MusicalKeyTag | undefined, semitones = 0): Spelling {
	return keyTag ? transposeKey(keyTag, semitones).spelling : 'sharp';
}

/**
 * The key a song lands in after transposing, in the same mode and spelled the conventional way: the
 * spelling with the fewest sharps or flats (E♭, not D♯; C♯m, not D♭m). A tie keeps the sharp one (F♯, D♯m).
 * Zero returns the key unchanged.
 */
export function transposeKey(keyTag: MusicalKeyTag, semitones: number) {
	const key = constantByTag('MusicalKeys', keyTag);
	if (mod12(semitones) === 0) return key;
	const pc = mod12(key.semitones + semitones);
	return MusicalKeys.filter(
		(candidate) => candidate.modeTag === key.modeTag && candidate.semitones === pc
	).reduce((best, candidate) =>
		Math.abs(candidate.signature) < Math.abs(best.signature) ? candidate : best
	);
}

/** The chord moved by `semitones`, respelled for `spelling`. Zero returns it unchanged. */
export function transpose(chord: Chord, semitones: number, spelling: Spelling = 'sharp'): Chord {
	if (mod12(semitones) === 0) return chord;
	const root = spellPitchClass(
		pitchClass(chord.rootTag, chord.accidentalTag) + semitones,
		spelling
	);
	const bass =
		chord.bassRootTag &&
		spellPitchClass(
			pitchClass(chord.bassRootTag, chord.bassAccidentalTag ?? 'natural') + semitones,
			spelling
		);
	return {
		rootTag: root.rootTag,
		accidentalTag: root.accidentalTag,
		qualityTag: chord.qualityTag,
		bassRootTag: bass?.rootTag,
		bassAccidentalTag: bass?.accidentalTag
	};
}

/** "G7", "D/F♯", "B♭m7" — the chord as shown on a chart, after transposing. */
export function formatChord(chord: Chord, semitones = 0, spelling: Spelling = 'sharp') {
	if (chord.qualityTag === 'noChord') return constantByTag('ChordQualities', 'noChord').suffix;
	const shown = transpose(chord, semitones, spelling);
	const bass = shown.bassRootTag
		? `/${noteName(shown.bassRootTag, shown.bassAccidentalTag ?? 'natural')}`
		: '';
	return (
		noteName(shown.rootTag, shown.accidentalTag) +
		constantByTag('ChordQualities', shown.qualityTag).suffix +
		bass
	);
}

/* ---------- Text ↔ chord, for the bracket syntax ---------- */

const accidentalAliases: Record<string, AccidentalTag> = {
	'#': 'sharp',
	'♯': 'sharp',
	b: 'flat',
	'♭': 'flat'
};

/* Longest first, so "maj7" wins over "m" and "m7" over "m". */
const qualitySpellings = ChordQualities.flatMap((quality) =>
	[quality.suffix, ...quality.aliases].map((text) => ({ text, tag: quality.tag }))
).sort((a, b) => b.text.length - a.text.length);

function parseNote(text: string) {
	const root = ChordRoots.find((r) => r.name === text[0]?.toUpperCase());
	if (!root) return undefined;
	const accidentalTag = accidentalAliases[text[1] ?? ''] ?? 'natural';
	const rest = text.slice(accidentalTag === 'natural' ? 1 : 2);
	// Respell what charts never write (E♯, F♭, C♭, B♯) to its legal enharmonic.
	const legal = (root.allowedAccidentals as readonly string[]).includes(accidentalTag)
		? { rootTag: root.tag, accidentalTag }
		: spellPitchClass(pitchClass(root.tag, accidentalTag), 'sharp');
	return { ...legal, rest };
}

/** "Am7" → chord, or undefined when it isn't one we can store (the text is then kept as lyrics). */
export function parseChord(text: string): Chord | undefined {
	text = text.trim();
	if (/^n\.?c\.?$/i.test(text))
		return { rootTag: 'c', accidentalTag: 'natural', qualityTag: 'noChord' };
	const [main = '', bassText, ...extra] = text.split('/');
	if (extra.length) return undefined;
	const note = parseNote(main);
	if (!note) return undefined;
	const quality = qualitySpellings.find((q) => q.text === note.rest && q.tag !== 'noChord');
	if (!quality) return undefined;
	if (bassText === undefined)
		return { rootTag: note.rootTag, accidentalTag: note.accidentalTag, qualityTag: quality.tag };
	const bass = parseNote(bassText);
	if (!bass || bass.rest) return undefined;
	return {
		rootTag: note.rootTag,
		accidentalTag: note.accidentalTag,
		qualityTag: quality.tag,
		bassRootTag: bass.rootTag,
		bassAccidentalTag: bass.accidentalTag
	};
}

/** The chord as typed in brackets: ASCII accidentals so it round-trips through a plain textarea. */
export function chordToText(chord: Chord) {
	if (chord.qualityTag === 'noChord') return 'N.C.';
	const ascii = (accidentalTag: AccidentalTag) =>
		({ natural: '', sharp: '#', flat: 'b' })[accidentalTag];
	const note = (rootTag: RootTag, accidentalTag: AccidentalTag) =>
		constantByTag('ChordRoots', rootTag).name + ascii(accidentalTag);
	const bass = chord.bassRootTag
		? `/${note(chord.bassRootTag, chord.bassAccidentalTag ?? 'natural')}`
		: '';
	return (
		note(chord.rootTag, chord.accidentalTag) +
		constantByTag('ChordQualities', chord.qualityTag).suffix +
		bass
	);
}

/** "G", "E♭", "C♯m" — a key's display name. */
export function keyName(keyTag: MusicalKeyTag) {
	return constantByTag('MusicalKeys', keyTag).name;
}

/** Reads a key the way it's written in ChordPro `{key: …}`: "G", "Eb", "F#m", "Cmin". */
export function parseKey(text: string): MusicalKeyTag | undefined {
	const note = parseNote(text.trim());
	const mode = KeyModes.find((m) => [m.suffix, ...m.aliases].some((s) => s === note?.rest));
	if (!note || !mode) return undefined;
	return MusicalKeys.find(
		(key) =>
			key.rootTag === note.rootTag &&
			key.accidentalTag === note.accidentalTag &&
			key.modeTag === mode.tag
	)?.tag;
}
