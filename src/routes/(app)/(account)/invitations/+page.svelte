<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Guitar from '@lucide/svelte/icons/guitar';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { glide, ms, reveal } from '#lib/motion.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const invitations = $derived(await convexQuery(api.invitation.listMine, {}));
	const client = useConvexClient();
	const sent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	/** The invitation being answered, and how, so the tapped button can say what's happening. */
	let answering = $state<{ id: Id<'JamSessionMember'>; accept: boolean }>();

	async function respond(invitation: (typeof invitations)[number], accept: boolean) {
		answering = { id: invitation._id, accept };
		try {
			if (accept) {
				await client.mutation(api.invitation.accept, { memberId: invitation._id });
				toast.success(`You’re in the band for “${invitation.jamSessionName}”`);
				await goto('/jams');
			} else {
				await client.mutation(api.invitation.decline, { memberId: invitation._id });
			}
		} catch (error) {
			toast.error(errorMessage(error));
			// Only on failure: on success the card leaves still saying what happened.
			answering = undefined;
		}
	}
</script>

<svelte:head>
	<title>Invitations · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Invitations</h1>

<!-- Spacing is each card's bottom padding, not a gap, so it leaves with the card instead of in one step. -->
<div class="mx-auto mt-8 max-w-2xl">
	<ul>
		{#each invitations as invitation (invitation._id)}
			{@const busy = answering?.id === invitation._id}
			<li animate:glide in:reveal out:fly={{ x: 40, duration: ms(200) }} class="pb-3">
				<div
					class="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm shadow-black/10 sm:flex-row sm:items-center"
				>
					<div class="flex min-w-0 flex-1 items-center gap-4">
						<span
							class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"
						>
							<Guitar class="size-5" />
						</span>
						<div class="min-w-0">
							<p class="text-lg leading-tight font-semibold">{invitation.jamSessionName}</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{invitation.invitedByName} invited you to play with them · {sent.format(
									invitation.invitedEpoch
								)}
							</p>
						</div>
					</div>
					<div class="flex gap-2">
						<Button
							variant="ghost"
							class="h-10 flex-1 rounded-xl sm:w-28 sm:flex-none"
							disabled={busy}
							onclick={() => respond(invitation, false)}
						>
							{busy && !answering?.accept ? 'Declining…' : 'Decline'}
						</Button>
						<Button
							class="h-10 flex-1 rounded-xl sm:w-36 sm:flex-none"
							disabled={busy}
							onclick={() => respond(invitation, true)}
						>
							{busy && answering?.accept ? 'Joining…' : 'Join the band'}
						</Button>
					</div>
				</div>
			</li>
		{/each}
	</ul>

	<!-- Out of the list, and in once the last card has flown off, so the two never overlap. -->
	{#if invitations.length === 0}
		<p
			in:fade={{ delay: ms(150), duration: ms(200) }}
			out:reveal
			class="rounded-2xl bg-card/60 p-10 text-center text-muted-foreground"
		>
			No invitations right now. When someone adds you to their band, it shows up here.
		</p>
	{/if}
</div>
