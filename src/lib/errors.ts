import { ConvexError } from 'convex/values';

/** The codes the backend throws (`new ConvexError('NOT_FOUND')`) that mean something to a person. */
const codeMessages: Record<string, string> = {
	NOT_FOUND: 'That isn’t there any more. It may have just been deleted.',
	NOT_SIGNED_IN: 'You’ve been signed out. Sign in again to carry on.'
};

/**
 * What to tell a person about a failed call: a ConvexError's own sentence (the backend writes those for people),
 * otherwise the fallback, so codes and internals like "[CONVEX M(…)] Server Error" never show.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
	if (!(error instanceof ConvexError) || typeof error.data !== 'string') return fallback;
	if (/^[A-Z_]+$/.test(error.data)) return codeMessages[error.data] ?? fallback;
	return error.data;
}
