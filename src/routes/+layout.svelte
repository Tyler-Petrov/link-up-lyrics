<script lang="ts">
	import '../app.css';
	import { setupConvex } from 'convex-svelte';
	import { useConvexClient } from 'convex-svelte';
	import { setConvexQueryCache } from '../lib/convex-query.svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setAuthContext, setConvexAuth } from '$lib/auth.svelte';

	let { data, children } = $props();
	
	setupConvex(PUBLIC_CONVEX_URL, {
		disabled: false,
	})
	const convexClient = useConvexClient();
	setConvexQueryCache(new Map());
	const auth = setAuthContext({
		// svelte-ignore state_referenced_locally
		isAuthenticated: Boolean(data.token),
	})
	setConvexAuth(convexClient, () => data.token ?? null, (isAuthenticated) => {
		if (isAuthenticated === auth.isAuthenticated) return
		auth.isAuthenticated = isAuthenticated;
	});
</script>

<main class="max-w-[150ch] mx-auto my-5 px-3">
	<nav class="flex justify-between items-center">
		<a href="/">
			<img src="/logo.svg" alt="Link Up Lyrics" class="h-10">
		</a>
		<div class="flex items-center gap-4">
			<a href="/sign-in">Sign In</a>
			<a href="/sign-up">Sign Up</a>
		</div>
	</nav>
	{@render children()}
</main>