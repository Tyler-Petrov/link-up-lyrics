<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { reveal } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';

	/*
	 * Tucks controls most people never need behind a quiet "Advanced" line, closed by default. The body mounts
	 * when it opens. From Jairus's text-collapsible.
	 */
	type Props = {
		label?: string;
		open?: boolean;
		class?: string;
		children: Snippet;
	};
	let { label = 'Advanced', open = $bindable(false), class: className, children }: Props = $props();

	const id = $props.id();
</script>

<!-- No gap between the trigger and the body: a gap can't animate, so it would appear in one step. The body
     carries its own top padding, which the slide grows along with the height. -->
<div class={cn('grid justify-items-start', className)}>
	<button
		type="button"
		class="-mx-1 flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
	>
		{label}
		<ChevronDown class={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} />
	</button>

	{#if open}
		<div {id} class="grid gap-3 justify-self-stretch pt-3" transition:reveal>
			{@render children()}
		</div>
	{/if}
</div>
