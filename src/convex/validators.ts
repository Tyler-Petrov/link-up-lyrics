import { v, type Infer } from 'convex/values';
import * as vb from 'valibot';
import { constantTags, constants, type ConstantName, type ConstantTag } from './constants';

/** Milliseconds since the Unix epoch. Fields holding one end in `Epoch`. */
export const epoch = () => v.number();

/** `{ type, _id }` — a reference to a document in one of several tables, indexable as a unit. Plan §4. */
export const discriminatedUnionItem = <const TTableName extends string>(tableName: TTableName) =>
	v.object({
		type: v.literal(tableName),
		_id: v.id(tableName)
	});

/** A union of the constant's tags, for schemas and function args. */
export function convexTagValidator<const TName extends ConstantName>(name: TName) {
	const [first, second, ...rest] = constantTags(name).map((tag) => v.literal(tag));
	return v.union(first!, second!, ...rest);
}

/** The same union as a valibot picklist, for forms. */
export function valibotTagValidator<const TName extends ConstantName>(
	name: TName,
	message?: string
) {
	const names = (constants[name] as readonly { name: string }[]).map((c) => c.name);
	return vb.picklist(
		constantTags(name) as [ConstantTag<TName>, ...ConstantTag<TName>[]],
		message ?? `Please choose ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`
	);
}

/* The chord carries its own accidental rather than a symbol string, so transposing is arithmetic. §6. */
export const chordValidator = v.object({
	rootTag: convexTagValidator('ChordRoots'),
	accidentalTag: convexTagValidator('Accidentals'),
	qualityTag: convexTagValidator('ChordQualities'),
	bassRootTag: v.optional(convexTagValidator('ChordRoots')), // D/F♯
	bassAccidentalTag: v.optional(convexTagValidator('Accidentals'))
});
export type Chord = Infer<typeof chordValidator>;

/** One grapheme, optionally carrying the chord played on it. */
export const characterValidator = v.object({
	character: v.string(),
	chord: v.optional(chordValidator)
});
export type ChartCharacter = Infer<typeof characterValidator>;
