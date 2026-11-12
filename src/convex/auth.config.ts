import type { AuthConfig } from 'convex/server';
import { env } from './_generated/server';

/* Trusts tokens from the Clerk instance's "convex" JWT template. Plan §12. */
export default {
	providers: [{ domain: env.CLERK_FRONTEND_API_URL, applicationID: 'convex' }]
} satisfies AuthConfig;
