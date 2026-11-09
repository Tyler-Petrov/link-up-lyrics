<script lang="ts">
	import { browser } from '$app/env';
	import AppHeader from '#lib/components/app-header.svelte';
	import PageError from '#lib/components/page-error.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	let { children } = $props();
</script>

<div class="flex min-h-dvh flex-col pb-24">
	<AppHeader />
	<main class="mx-auto mt-10 w-[min(100%-2rem,56rem)] flex-1">
		<!-- Pages `await` their convexQuery calls. The server renders them whole (with the signed-in person's
		     Convex token); in the browser a first load shows `pending`, and later navigations keep the current
		     page until the next one is ready. A pending snippet on the server would send it instead of the page. -->
		<svelte:boundary pending={browser ? pending : undefined}>
			{@render children()}

			{#snippet failed(error, reset)}
				<PageError {error} {reset} />
			{/snippet}
		</svelte:boundary>

		{#snippet pending()}
			<div class="flex flex-col items-center gap-6 pt-6">
				<Skeleton class="h-12 w-64 rounded-2xl" />
				<Skeleton class="h-40 w-full rounded-2xl" />
			</div>
		{/snippet}
	</main>
</div>
