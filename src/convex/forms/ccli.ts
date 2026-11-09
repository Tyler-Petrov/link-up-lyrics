import * as vb from 'valibot';

export const ccliLicenseSchema = vb.object({
	/* CCLI license numbers are digits; blank clears it. */
	ccliLicenseNumber: vb.pipe(
		vb.string(),
		vb.trim(),
		vb.regex(/^\d{0,12}$/, 'A CCLI license number is digits only')
	)
});
