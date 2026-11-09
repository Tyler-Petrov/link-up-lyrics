import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_CONVEX_URL: {
		public: true,
		static: true,
		description: 'Convex deployment URL, written to .env.local by `convex dev`'
	},
	PUBLIC_CONVEX_SITE_URL: {
		public: true,
		static: true,
		description:
			'Convex HTTP actions URL (webhooks, presence beacon), written to .env.local by `convex dev`'
	},
	PUBLIC_CLERK_PUBLISHABLE_KEY: {
		public: true,
		static: true,
		description: 'Clerk publishable key (pk_test_ in .env.local, pk_live_ in .env.production)'
	},
	CLERK_SECRET_KEY: {
		public: false,
		static: false,
		description:
			'Clerk secret key (sk_test_ in .env.local, a Worker secret in production): server-side sign-in and the SSR Convex token (hooks.server.ts)'
	}
});
