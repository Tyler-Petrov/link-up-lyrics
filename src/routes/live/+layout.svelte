<script lang="ts">
	import { browser } from '$app/env';
	import PageError from '#lib/components/page-error.svelte';

	// The QR target's own minimal layout: no header, dark always (plan §9, §14.5). The page awaits its query:
	// the server renders it whole, and a first load in the browser shows the pending dot.
	let { children } = $props();
</script>

<div class="dark stage min-h-dvh bg-background text-foreground [color-scheme:dark]">
	<svelte:boundary pending={browser ? pending : undefined}>
		{@render children()}

		{#snippet failed(error, reset)}
			<div class="grid min-h-dvh place-items-center p-6"><PageError {error} {reset} /></div>
		{/snippet}
	</svelte:boundary>

	{#snippet pending()}
		<div class="grid min-h-dvh place-items-center">
			<span class="size-3 animate-pulse rounded-full bg-muted-foreground"></span>
		</div>
	{/snippet}
</div>
