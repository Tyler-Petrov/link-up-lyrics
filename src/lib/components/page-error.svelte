<script lang="ts">
	import { ConvexError } from 'convex/values';
	import { Button } from '#lib/components/ui/button/index.js';

	let { error, reset }: { error: unknown; reset: () => void } = $props();

	const message = $derived(
		error instanceof ConvexError
			? String(error.data)
			: error instanceof Error
				? error.message
				: 'Something went wrong.'
	);
</script>

<div class="flex flex-col items-center gap-4 rounded-2xl bg-card p-10 text-center">
	<p class="text-lg font-semibold">That didn't load.</p>
	<p class="max-w-prose text-sm text-muted-foreground">{message}</p>
	<Button variant="secondary" class="rounded-xl" onclick={reset}>Try again</Button>
</div>
