import { defineApp } from 'convex/server';
import { v } from 'convex/values';
import migrations from '@convex-dev/migrations/convex.config.js';
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js';
import presence from '@convex-dev/presence/convex.config.js';

const app = defineApp({
	env: {
		/* The Clerk instance's Frontend API URL (the JWT issuer), e.g. https://clerk.linkuplyrics.com */
		CLERK_FRONTEND_API_URL: v.string()
	}
});
app.use(migrations);
/* Mounted now so feature work doesn't need to touch this file. Clients in components.ts. */
app.use(rateLimiter);
app.use(presence);

export default app;
