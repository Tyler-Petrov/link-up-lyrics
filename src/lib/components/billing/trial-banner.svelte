<script module lang="ts">
	// Dismissed for this visit only: back on the next load, since the trial really is ending. §13.3.3.
	let dismissed = $state(false);
</script>

<script lang="ts">
	/*
	 * A slim note from day 10 of the 14-day trial: the trial deadline is the whole conversion mechanism, so it
	 * says the date once, quietly, across the signed-in app. Never on /live, nor on the jam console the night
	 * is run from: billing is between us and the owner, not the room. §13.1.
	 */
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import X from '@lucide/svelte/icons/x';
	import { api } from '#convex/_generated/api.js';
	import { trialEndingSoonEpoch } from '#convex/model/billing.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const user = $derived(await convexQuery(api.user.me, {}));
	const endsEpoch = $derived(trialEndingSoonEpoch(user, Date.now()));
	const date = new Intl.DateTimeFormat(undefined, {
		weekday: 'long',
		month: 'short',
		day: 'numeric'
	});
</script>

{#if endsEpoch && !dismissed && page.route.id !== '/(app)/(account)/jams/[jamSessionId]'}
	<div
		transition:slide={{ duration: 200 }}
		role="status"
		class="mb-6 flex items-center gap-3 rounded-2xl bg-primary/15 py-2 pr-2 pl-4 text-sm"
	>
		<Hourglass class="size-4 shrink-0 text-primary" />
		<p class="min-w-0 flex-1 leading-snug">
			Your free trial ends <span class="font-semibold">{date.format(endsEpoch)}</span>. Pick a plan
			to keep hosting.
			{#if page.url.pathname !== '/account'}
				<a
					href="/account"
					class="ml-1 font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
					>See plans</a
				>
			{/if}
		</p>
		<Button
			variant="ghost"
			size="icon"
			class="shrink-0 rounded-xl text-muted-foreground"
			aria-label="Dismiss"
			onclick={() => (dismissed = true)}
		>
			<X />
		</Button>
	</div>
{/if}
