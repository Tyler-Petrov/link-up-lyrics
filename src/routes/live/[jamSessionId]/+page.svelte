<script lang="ts">
	import { page } from '$app/state';
</script>

<!-- TODO(live): convexQuery(api.live.watch, { jamSessionId }) → the focused group, chords stripped server-side
     for the room; view setting in localStorage (current group / + dimmed next / whole song highlighted);
     presence heartbeat; wake lock. Brief "Live view", plan §14–15. -->
<main class="grid min-h-dvh place-items-center p-6 text-center">
	<div class="flex flex-col gap-3">
		<h1 class="page-title">Waiting for the leader…</h1>
		<p class="text-sm text-muted-foreground">Session {page.params.jamSessionId}</p>
	</div>
</main>
