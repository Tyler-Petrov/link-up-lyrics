import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// Every interface, so the dev server's Tailscale URLs reach it (scripts/dev-service.mjs).
	server: { host: true, allowedHosts: ['.ts.net'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true }
			},
			adapter: adapter(),
			// Open pages notice a release within five minutes, or right away (src/convex/client_reload.ts).
			version: { pollInterval: 5 * 60_000 }
		})
	]
});
