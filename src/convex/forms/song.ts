/* Valibot schemas shared by song forms (client validation) and their valibotMutations (server). */
import * as vb from 'valibot';
import { valibotTagValidator } from '../validators';

const optionalText = vb.optional(vb.pipe(vb.string(), vb.trim(), vb.maxLength(200)));

export const createSongFromTextSchema = vb.object({
	title: optionalText,
	artist: optionalText,
	text: vb.pipe(
		vb.string('Paste the song’s words'),
		vb.trim(),
		vb.nonEmpty('Paste the song’s words'),
		vb.maxLength(50_000)
	)
});

export const songMetadataSchema = vb.object({
	songId: vb.string(),
	title: vb.pipe(
		vb.string('Give the song a title'),
		vb.trim(),
		vb.nonEmpty('Give the song a title'),
		vb.maxLength(200)
	),
	artist: optionalText,
	originalKeyTag: vb.optional(valibotTagValidator('MusicalKeys')),
	capo: vb.optional(vb.pipe(vb.number(), vb.integer(), vb.minValue(0), vb.maxValue(12))),
	copyrightSourceTag: valibotTagValidator('CopyrightSources'),
	ccliSongNumber: optionalText,
	copyrightLine: optionalText,
	songwriters: vb.array(vb.pipe(vb.string(), vb.trim(), vb.nonEmpty(), vb.maxLength(200)))
});
