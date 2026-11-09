<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';

	/* "N watching · M in the band": presence (who's connected now) and membership (who's in the band). §15. */
	let { jamSessionId }: { jamSessionId: Id<'JamSession'> } = $props();

	const count = $derived(await convexQuery(api.jam_session.connectedCount, { jamSessionId }));
</script>

<p class="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
	<Eye class="size-4 shrink-0" />
	<span><strong class="font-semibold text-foreground">{count.watching}</strong> watching</span>
	<span aria-hidden="true">·</span>
	<span><strong class="font-semibold text-foreground">{count.band}</strong> in the band</span>
</p>
