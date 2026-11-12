import { defineApp } from 'convex/server';
import { v } from 'convex/values';
import migrations from '@convex-dev/migrations/convex.config.js';
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js';
import presence from '@convex-dev/presence/convex.config.js';

const app = defineApp({
	env: {
		/* The Clerk instance's Frontend API URL (the JWT issuer), e.g. https://clerk.linkuplyrics.com */
		CLERK_FRONTEND_API_URL: v.string(),
		/* Clerk Backend API key, for application invitations to people without an account. §14.3. */
		CLERK_SECRET_KEY: v.optional(v.string()),
		/* "true" to actually send those invitations; anything else leaves them off (dev, testing). */
		CLERK_INVITATIONS_ENABLED: v.optional(v.string()),
		/* Signing secret of the Clerk webhook endpoint (billing events → User). §13.3.2. */
		CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
		/* The app's origin, e.g. https://linkuplyrics.com, so invitation emails land on /invitations. */
		SITE_URL: v.optional(v.string())
	}
});
app.use(migrations);
/* Mounted now so feature work doesn't need to touch this file. Clients in components.ts. */
app.use(rateLimiter);
app.use(presence);

export default app;
