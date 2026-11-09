import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

/**
 * Throws unless `user` may host jam sessions (create one, take one live). Hostability follows the session
 * owner, not whoever taps the button. §13.3.
 *
 * TODO(billing): stub that allows everyone; the billing agent replaces it with the plan/grace/comp check.
 */
export async function requireCanHost(_ctx: QueryCtx, _user: Doc<'User'>) {}
