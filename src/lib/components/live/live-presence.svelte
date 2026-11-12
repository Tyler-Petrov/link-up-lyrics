<script lang="ts">
	import { IsDocumentVisible } from 'runed';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	/*
	 * Counts this tab as watching while it's visible (§15). Three layers: the effect teardown covers leaving
	 * the page, pagehide covers closing the tab, and the heartbeat timeout (2.5 intervals) covers phones that
	 * just vanish. Renders nothing.
	 */
	let { jamSessionId }: { jamSessionId: Id<'JamSession'> } = $props();

	const HEARTBEAT_INTERVAL = 10_000;
	const client = useConvexClient();
	const visible = new IsDocumentVisible();
	const sessionId = crypto.randomUUID();
	let sessionToken: string | undefined;

	function leave() {
		if (sessionToken) void client.mutation(api.live.disconnect, { sessionToken });
		sessionToken = undefined;
	}

	$effect(() => {
		if (!visible.current) return; // a hidden tab stops beating and expires
		const id = jamSessionId;
		let disposed = false;
		const beat = () =>
			client
				.mutation(api.live.heartbeat, { jamSessionId: id, sessionId, interval: HEARTBEAT_INTERVAL })
				.then((result) => {
					// A beat that lands after leave() would count this tab again: leave with it instead.
					if (disposed)
						void client.mutation(api.live.disconnect, { sessionToken: result.sessionToken });
					else sessionToken = result.sessionToken;
				})
				.catch(() => {}); // a missed beat is harmless; the next one catches up
		void beat();
		const timer = setInterval(beat, HEARTBEAT_INTERVAL);
		return () => {
			disposed = true;
			clearInterval(timer);
			leave();
		};
	});
</script>

<svelte:window onpagehide={leave} />
