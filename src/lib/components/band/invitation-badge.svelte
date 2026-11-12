<script lang="ts">
	/* The nav's pending-invitation count. Not awaited: the header renders outside the page's async boundary. */
	import { scale } from 'svelte/transition';
	import { api } from '#convex/_generated/api.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { ms } from '#lib/motion.js';

	const invitations = convexQuery(api.invitation.listMine, {});
	const count = $derived(invitations.current?.length ?? 0);
</script>

{#if count > 0}
	<span
		transition:scale={{ duration: ms(180), start: 0.4 }}
		aria-label="{count} pending"
		class="absolute top-0 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground"
	>
		{count}
	</span>
{/if}
