<script lang="ts">
	import { page } from '$app/state';
	import { useClerkContext } from 'svelte-clerk/client';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button } from '#lib/components/ui/button/index.js';

	// Redeems a sign-in link from scripts/sign-in.mjs (a Clerk sign-in token), then goes on to where the link
	// points (?url=, only ever on this site). From meal-tracker / Jairus. Dev only: tokens come from the dev
	// instance's secret key.
	const clerk = useClerkContext();
	let failed = $state<string>();
	let started = false;

	const successUrl = $derived.by(() => {
		const url = new URL(page.url.searchParams.get('url') ?? '/', page.url.origin);
		return url.origin === page.url.origin ? url.href : '/';
	});

	$effect(() => {
		if (clerk.isLoaded && !started) {
			started = true;
			void signIn();
		}
	});

	async function signIn() {
		try {
			// Whoever's signed in now goes first, so the browser ends up as the link's person.
			if (clerk.session) await clerk.clerk?.signOut({ redirectUrl: page.url.href });
			const attempt = await clerk.clerk?.client?.signIn.create({
				strategy: 'ticket',
				ticket: page.params.token ?? ''
			});
			if (attempt?.status !== 'complete' || !attempt.createdSessionId) {
				failed = 'Clerk couldn’t complete the sign-in.';
				return;
			}
			await clerk.clerk?.setActive({ session: attempt.createdSessionId });
			// A full load, so the server renders the next page signed in (and syncs the User row).
			location.replace(successUrl);
		} catch (error) {
			failed = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<svelte:head>
	<title>Signing in</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="grid min-h-dvh place-items-center p-6 text-center">
	{#if failed}
		<div class="flex max-w-sm flex-col items-center gap-3">
			<p class="text-lg font-semibold">This sign-in link is invalid or has expired</p>
			<!-- Clerk's own words, for whoever's debugging. -->
			<p class="text-sm text-muted-foreground">{failed}</p>
			<Button href="/" variant="secondary" class="mt-2 rounded-xl">Go home</Button>
		</div>
	{:else}
		<p class="flex items-center gap-2 text-lg text-muted-foreground">
			<LoaderCircle class="size-5 animate-spin" /> Signing in…
		</p>
	{/if}
</main>
