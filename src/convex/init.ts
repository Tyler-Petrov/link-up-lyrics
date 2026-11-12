import { internal } from './_generated/api';
import { internalMutation } from './functions';
import { newMigrations } from './migrations';

/* Runs after every deploy (the release workflow and `pnpm dev` call it), so data changes ship with code. */
export default internalMutation({
	args: {},
	handler: async (ctx) => {
		if (newMigrations.length > 0) {
			await ctx.runMutation(internal.migrations.runNewMigrations, {});
		}
	}
});
