<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { ComponentProps } from 'svelte';
	import { cn } from '#lib/utils.js';

	// Something is working. It turns only when motion is welcome; under reduced motion it holds still.
	let { class: className, ...restProps }: ComponentProps<typeof LoaderCircle> = $props();
</script>

<LoaderCircle
	role="status"
	aria-label="Loading"
	class={cn('motion-safe:animate-spin', className)}
	{...restProps}
/>
