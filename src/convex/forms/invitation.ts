import * as vb from 'valibot';

export const inviteSchema = vb.object({
	jamSessionId: vb.string(),
	email: vb.pipe(
		vb.string('Enter their email'),
		vb.trim(),
		vb.toLowerCase(),
		vb.nonEmpty('Enter their email'),
		vb.email('That doesn’t look like an email'),
		vb.maxLength(254)
	)
});
