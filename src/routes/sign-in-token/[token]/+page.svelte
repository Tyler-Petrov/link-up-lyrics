<script lang="ts">
	import { page } from '$app/state';
	import { useClerkContext } from 'svelte-clerk/client';

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
				failed = "The sign-in couldn't be completed.";
				return;
			}
			await clerk.clerk?.setActive({ session: attempt.createdSessionId });
			// A full load, so the server renders the next page signed in (and syncs the User row).
			location.replace(successUrl);
		} catch (error) {
			failed =
				error instanceof Error ? error.message : 'This sign-in link is invalid or has expired.';
		}
	}
</script>

<svelte:head>
	<title>Signing in</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="grid min-h-dvh place-items-center p-6 text-center">
	<p class="text-lg {failed ? 'text-destructive' : 'text-muted-foreground'}">
		{failed ?? 'Signing in…'}
	</p>
</main>
