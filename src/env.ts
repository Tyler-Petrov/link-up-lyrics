import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_CONVEX_URL: {
		public: true,
		static: true,
		description:
			"Convex deployment URL, written to .env.local by the worktree setup (the branch's own deployment)"
	},
	PUBLIC_CONVEX_SITE_URL: {
		public: true,
		static: true,
		description:
			'Convex HTTP actions URL (webhooks, presence beacon), written to .env.local by the worktree setup'
	},
	PUBLIC_CLERK_PUBLISHABLE_KEY: {
		public: true,
		static: true,
		description: 'Clerk publishable key (pk_test_ in .env.development, pk_live_ in .env.production)'
	},
	PUBLIC_CLERK_BILLING_ENABLED: {
		public: true,
		static: true,
		schema: (value) => value === 'true',
		description:
			'"true" once Clerk Billing is set up (plan "pro", both prices): /account shows the <PricingTable>. Clerk throws when it renders with billing off.'
	},
	PUBLIC_POSTHOG_KEY: {
		public: true,
		static: true,
		schema: (value) => value || undefined,
		description:
			'PostHog project API key (analytics and error tracking, #lib/posthog.ts). Unset, PostHog stays off.'
	},
	CLERK_SECRET_KEY: {
		public: false,
		static: false,
		description:
			'Clerk secret key (sk_test_ in .env.local, pulled from the Convex deployment by the worktree setup; a Worker secret in production): server-side sign-in and the SSR Convex token (hooks.server.ts)'
	}
});
