import { mutation } from './functions';
import { authQuery } from './functions';
import { ensureUser } from './model/user';

/** Creates or refreshes the caller's User row. The app calls it once Clerk signs someone in. */
export const ensure = mutation({
	args: {},
	handler: async (ctx) => (await ensureUser(ctx))._id
});

/** The signed-in person's profile and billing state. */
export const me = authQuery({
	args: {},
	handler: async (ctx) => ctx.user
});
