<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { appear } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';

	/*
	 * "N watching · M in the band": presence (who has the live page open) and membership (who's in the band).
	 * Before going live the same people are waiting for it. §15.
	 */
	type Props = { jamSessionId: Id<'JamSession'>; isLive: boolean; class?: string };
	let { jamSessionId, isLive, class: className }: Props = $props();

	// Not awaited, so the console never waits on it: each number keeps its place and fades in when it arrives.
	const count = $derived(convexQuery(api.jam_session.connectedCount, { jamSessionId }));
</script>

<p class={cn('flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground', className)}>
	<Eye class="size-4 shrink-0" />
	<span>{@render number(count.current?.watching)} {isLive ? 'watching' : 'waiting'}</span>
	<span class="max-sm:hidden" aria-hidden="true">·</span>
	<span class="max-sm:hidden">{@render number(count.current?.band)} in the band</span>
</p>

{#snippet number(value: number | undefined)}
	<strong class="inline-block min-w-[1ch] text-right font-semibold text-foreground tabular-nums">
		{#key value}<span class="inline-block" in:appear>{value ?? ''}</span>{/key}
	</strong>
{/snippet}
