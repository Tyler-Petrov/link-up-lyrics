<script lang="ts">
	import { page } from '$app/state';
	import AppHeader from '#lib/components/app-header.svelte';
	import PageError from '#lib/components/page-error.svelte';

	// Unknown addresses and failed loads, in the app's chrome rather than SvelteKit's bare text.
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · Link Up Lyrics</title>
</svelte:head>

<div class="flex min-h-dvh flex-col pb-24">
	<AppHeader />
	<main class="mx-auto mt-10 w-[min(100%-2rem,56rem)] flex-1">
		{#if notFound}
			<PageError
				title="Page not found"
				message="There’s nothing at this address. The link may be old or mistyped."
			/>
		{:else}
			<PageError title="Something went wrong" error={page.error} retry={() => location.reload()} />
		{/if}
	</main>
</div>
