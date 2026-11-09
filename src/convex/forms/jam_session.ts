/* Valibot schemas shared by jam session forms (client validation) and their valibotMutations (server). */
import * as vb from 'valibot';

const name = vb.pipe(
	vb.string('Give the session a name'),
	vb.trim(),
	vb.nonEmpty('Give the session a name'),
	vb.maxLength(120)
);

export const createJamSessionSchema = vb.object({ name });

export const renameJamSessionSchema = vb.object({ jamSessionId: vb.string(), name });
