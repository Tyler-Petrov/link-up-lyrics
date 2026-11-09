/*
 * Frozen `{ tag, name, … }` arrays. Each one is the schema validator (convexTagValidator), the form
 * validator (valibotTagValidator), the UI label source (constantByTag) and the type (ConstantTag), so a
 * vocabulary is defined once. Tags are camelCase. Plan §5.
 */

export const Accidentals = Object.freeze([
	{ tag: 'natural', name: 'Natural', symbol: '', semitones: 0 },
	{ tag: 'sharp', name: 'Sharp', symbol: '♯', semitones: 1 },
	{ tag: 'flat', name: 'Flat', symbol: '♭', semitones: -1 }
] as const);

/* allowedAccidentals = the spellings that actually appear on charts.        */
/* No E♯, no F♭, no double accidentals — they'd only ever be a typo here.    */
export const ChordRoots = Object.freeze([
	{ tag: 'c', name: 'C', semitones: 0, allowedAccidentals: ['natural', 'sharp'] },
	{ tag: 'd', name: 'D', semitones: 2, allowedAccidentals: ['natural', 'sharp', 'flat'] },
	{ tag: 'e', name: 'E', semitones: 4, allowedAccidentals: ['natural', 'flat'] },
	{ tag: 'f', name: 'F', semitones: 5, allowedAccidentals: ['natural', 'sharp'] },
	{ tag: 'g', name: 'G', semitones: 7, allowedAccidentals: ['natural', 'sharp', 'flat'] },
	{ tag: 'a', name: 'A', semitones: 9, allowedAccidentals: ['natural', 'sharp', 'flat'] },
	{ tag: 'b', name: 'B', semitones: 11, allowedAccidentals: ['natural', 'flat'] }
] as const);

export type Spelling = 'sharp' | 'flat';

/* `signatureShift` is how far round the circle of fifths the key signature sits from the root's major:  */
/* A minor shares C major's signature, three fifths below A major's. That's why Cm spells like E♭.       */
export const KeyModes = Object.freeze([
	{ tag: 'major', name: 'Major', suffix: '', aliases: [], signatureShift: 0 },
	{ tag: 'minor', name: 'Minor', suffix: 'm', aliases: ['min'], signatureShift: -3 }
] as const);

/* A key IS a root, an accidental and a mode, so keys are derived: "c", "eFlat", "cSharpMinor". The flatMap */
/* below loses the literal tags; these types buy them back so convexTagValidator('MusicalKeys') is a real  */
/* union. The default part (natural, major) adds nothing to the tag.                                       */
type TagPart<T extends string> = T extends 'natural' | 'major' ? '' : Capitalize<T>;
type RootKeyTag<R extends (typeof ChordRoots)[number]> = R extends unknown
	? `${R['tag']}${TagPart<R['allowedAccidentals'][number]>}`
	: never;
export type MusicalKeyTag =
	`${RootKeyTag<(typeof ChordRoots)[number]>}${TagPart<(typeof KeyModes)[number]['tag']>}`;
const tagPart = (tag: string) =>
	tag === 'natural' || tag === 'major' ? '' : tag[0]!.toUpperCase() + tag.slice(1);

/* Steps of 7 semitones (a fifth) from C: G 1, D 2, A 3, E 4, B 5, and F one fifth below, -1. */
const fifthsFromC = (semitones: number) => ((semitones * 7 + 1) % 12) - 1;

export const MusicalKeys = Object.freeze(
	KeyModes.flatMap((mode) =>
		ChordRoots.flatMap((root) =>
			root.allowedAccidentals.map((accidentalTag) => {
				const accidental = Accidentals.find((a) => a.tag === accidentalTag)!;
				/* Sharps (positive) or flats (negative) in the key signature: E♭ -3, Cm -3, F♯m 3. */
				const signature =
					fifthsFromC(root.semitones) + 7 * accidental.semitones + mode.signatureShift;
				return {
					tag: (root.tag + tagPart(accidentalTag) + tagPart(mode.tag)) as MusicalKeyTag,
					name: root.name + accidental.symbol + mode.suffix,
					rootTag: root.tag,
					accidentalTag,
					modeTag: mode.tag,
					semitones: (root.semitones + accidental.semitones + 12) % 12,
					signature,
					/* Flat keys (F, B♭, Dm, Cm…) are spelled with flats; the rest, F♯ included, with sharps. */
					spelling: (signature < 0 ? 'flat' : 'sharp') as Spelling
				};
			})
		)
	)
);

/* `aliases` are other ways charts write the same suffix, read by the bracket parser only. */
export const ChordQualities = Object.freeze([
	{ tag: 'major', name: 'Major', suffix: '', aliases: ['maj', 'M'], intervals: [0, 4, 7] },
	{ tag: 'minor', name: 'Minor', suffix: 'm', aliases: ['min', '-'], intervals: [0, 3, 7] },
	{ tag: 'dominant7', name: 'Dominant 7th', suffix: '7', aliases: [], intervals: [0, 4, 7, 10] },
	{
		tag: 'major7',
		name: 'Major 7th',
		suffix: 'maj7',
		aliases: ['M7', 'Δ', 'Δ7'],
		intervals: [0, 4, 7, 11]
	},
	{
		tag: 'minor7',
		name: 'Minor 7th',
		suffix: 'm7',
		aliases: ['min7', '-7'],
		intervals: [0, 3, 7, 10]
	},
	{ tag: 'sixth', name: '6th', suffix: '6', aliases: [], intervals: [0, 4, 7, 9] },
	{ tag: 'ninth', name: '9th', suffix: '9', aliases: [], intervals: [0, 4, 7, 10, 14] },
	{ tag: 'sus2', name: 'Suspended 2nd', suffix: 'sus2', aliases: [], intervals: [0, 2, 7] },
	{ tag: 'sus4', name: 'Suspended 4th', suffix: 'sus4', aliases: ['sus'], intervals: [0, 5, 7] },
	{
		tag: 'dominant7sus4',
		name: 'Suspended 7th',
		suffix: '7sus4',
		aliases: ['7sus'],
		intervals: [0, 5, 7, 10]
	},
	{ tag: 'add9', name: 'Add 9', suffix: 'add9', aliases: ['add2', '2'], intervals: [0, 4, 7, 14] },
	{
		tag: 'diminished',
		name: 'Diminished',
		suffix: 'dim',
		aliases: ['°', 'o'],
		intervals: [0, 3, 6]
	},
	{
		tag: 'diminished7',
		name: 'Diminished 7th',
		suffix: 'dim7',
		aliases: ['°7', 'o7'],
		intervals: [0, 3, 6, 9]
	},
	{
		tag: 'halfDiminished',
		name: 'Half-Diminished',
		suffix: 'm7b5',
		aliases: ['m7♭5', 'min7b5', 'ø', 'ø7'],
		intervals: [0, 3, 6, 10]
	},
	{ tag: 'augmented', name: 'Augmented', suffix: 'aug', aliases: ['+'], intervals: [0, 4, 8] },
	{ tag: 'power', name: 'Power Chord', suffix: '5', aliases: [], intervals: [0, 7] },
	{ tag: 'noChord', name: 'No Chord', suffix: 'N.C.', aliases: ['NC'], intervals: [] }
] as const);

export const SongLineKinds = Object.freeze([
	{ tag: 'lyric', name: 'Lyric' },
	{ tag: 'comment', name: 'Performance Note' }
] as const);

/*
 * What a SongSection holds. Its `name` is free text ("Chorus 2 (half-time)"); this is only whether it has
 * words. An interlude has no words (an instrumental, a turnaround) — its lines are runs of spaces carrying
 * chords for the players, and singers see a "music only" card instead.
 */
export const SongSectionKinds = Object.freeze([
	{ tag: 'lyrics', name: 'Block' },
	{ tag: 'interlude', name: 'Interlude' }
] as const);

/* Ordered least → most privileged so atTagOrHigher() works. Do not sort.   */
/* Members are INVITED account holders — the people playing. Everyone else  */
/* singing along has no account and no row at all. §14.2.                   */
export const JamSessionRoles = Object.freeze([
	{ tag: 'player', name: 'Player', description: 'Sees the setlist and the chords' },
	{ tag: 'leader', name: 'Leader', description: 'Controls what everyone sees' },
	{ tag: 'owner', name: 'Owner', description: 'Invites and removes members, deletes the session' }
] as const);

/* Deliberately separate from the role: status isn't a privilege level. */
export const MembershipStatuses = Object.freeze([
	{ tag: 'invited', name: 'Invited', description: 'Waiting on them to accept' },
	{ tag: 'accepted', name: 'Accepted', description: 'In the band' },
	{ tag: 'declined', name: 'Declined', description: 'Said no; can be re-invited' },
	{ tag: 'removed', name: 'Removed', description: 'Taken out by the owner' }
] as const);

export const CopyrightSources = Object.freeze([
	{ tag: 'unknown', name: 'Not Specified', requiresLicense: true },
	{ tag: 'publicDomain', name: 'Public Domain', requiresLicense: false },
	{ tag: 'original', name: 'My Own Song', requiresLicense: false },
	{ tag: 'ccli', name: 'CCLI Licensed', requiresLicense: true },
	{ tag: 'otherLicense', name: 'Other License', requiresLicense: true }
] as const);

/* You pay to host; everything else is free. canHostSessions is the only gate. §13.3. */
export const SubscriptionPlans = Object.freeze([
	/* "none" = a member of someone else's band who has never subscribed. */
	{ tag: 'none', name: 'Band Member', canHostSessions: false },
	{ tag: 'expired', name: 'Trial Ended', canHostSessions: false },
	{ tag: 'trialing', name: 'Free Trial', canHostSessions: true },
	{ tag: 'pro', name: 'Pro', canHostSessions: true }
] as const);

/* Separate from the plan on purpose: a Pro user whose card failed is still Pro. §13.3.2. */
export const PaymentStatuses = Object.freeze([
	{ tag: 'current', name: 'Current', needsAttention: false },
	{ tag: 'pastDue', name: 'Payment Failed', needsAttention: true }
] as const);

/* Event names live here so a typo can't silently fork a funnel. */
export const AnalyticsEvents = Object.freeze([
	{ tag: 'songCreated', name: 'Song Created' },
	{ tag: 'chordSet', name: 'Chord Set' },
	{ tag: 'sectionCreated', name: 'Section Created' },
	{ tag: 'jamSessionStarted', name: 'Jam Session Started' },
	{ tag: 'liveViewOpened', name: 'Live View Opened' },
	{ tag: 'focusChanged', name: 'Focus Changed' },
	{ tag: 'invitationSent', name: 'Invitation Sent' },
	{ tag: 'invitationAccepted', name: 'Invitation Accepted' },
	{ tag: 'subscriptionStarted', name: 'Subscription Started' }
] as const);

export const constants = {
	Accidentals,
	ChordRoots,
	KeyModes,
	MusicalKeys,
	ChordQualities,
	SongLineKinds,
	SongSectionKinds,
	JamSessionRoles,
	MembershipStatuses,
	CopyrightSources,
	SubscriptionPlans,
	PaymentStatuses,
	AnalyticsEvents
};
export type Constants = typeof constants;
export type ConstantName = keyof Constants;
export type ConstantTag<T extends ConstantName> = Constants[T][number]['tag'];

/** The constant with that tag (or the element type, for derived arrays like MusicalKeys whose tags aren't per-row literals). */
type ConstantOf<TName extends ConstantName, TTag extends string> = [
	Extract<Constants[TName][number], { tag: TTag }>
] extends [never]
	? Constants[TName][number]
	: Extract<Constants[TName][number], { tag: TTag }>;

export function constantByTag<
	const TName extends ConstantName,
	const TTag extends ConstantTag<TName> | undefined
>(name: TName, tag: TTag) {
	return (constants[name] as readonly { tag: string }[]).find(
		(c) => c.tag === tag
	) as TTag extends undefined ? undefined : ConstantOf<TName, TTag & string>;
}

/** Whether `currentTag` sits at or after `queryTag` in the constant's order. Undefined is never enough. */
export function atTagOrHigher<const TName extends ConstantName>(
	name: TName,
	currentTag: ConstantTag<TName> | undefined,
	queryTag: ConstantTag<TName>
) {
	if (currentTag === undefined) return false;
	const tags = (constants[name] as readonly { tag: string }[]).map((c) => c.tag);
	return tags.indexOf(currentTag) >= tags.indexOf(queryTag);
}

export function constantTags<const TName extends ConstantName>(name: TName) {
	return (constants[name] as readonly { tag: string }[]).map((c) => c.tag) as ConstantTag<TName>[];
}
