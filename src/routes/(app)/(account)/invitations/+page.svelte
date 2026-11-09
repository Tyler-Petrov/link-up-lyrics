<script lang="ts">
	import { goto } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import Guitar from '@lucide/svelte/icons/guitar';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const invitations = $derived(await convexQuery(api.invitation.listMine, {}));
	const client = useConvexClient();
	const sent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	let busy = $state<Id<'JamSessionMember'>>();

	async function respond(memberId: Id<'JamSessionMember'>, accept: boolean) {
		busy = memberId;
		try {
			if (accept) {
				await client.mutation(api.invitation.accept, { memberId });
				toast.success('You’re in the band');
				await goto('/jams');
			} else {
				await client.mutation(api.invitation.decline, { memberId });
			}
		} catch (error) {
			toast.error(error instanceof ConvexError ? String(error.data) : 'Something went wrong.');
		} finally {
			busy = undefined;
		}
	}
</script>

<svelte:head>
	<title>Invitations · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Invitations</h1>

<ul class="mx-auto mt-8 flex max-w-2xl flex-col gap-3">
	{#each invitations as invitation (invitation._id)}
		<li
			animate:flip={{ duration: 200 }}
			in:fade={{ duration: 150 }}
			out:fly={{ x: 40, duration: 200 }}
			class="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm shadow-black/10 sm:flex-row sm:items-center"
		>
			<span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
				<Guitar class="size-5" />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-lg leading-tight font-semibold">{invitation.jamSessionName}</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{invitation.invitedByName} invited you to play with them · {sent.format(
						invitation.invitedEpoch
					)}
				</p>
			</div>
			<div class="flex gap-2">
				<Button
					variant="ghost"
					class="h-10 flex-1 rounded-xl sm:flex-none"
					disabled={busy === invitation._id}
					onclick={() => respond(invitation._id, false)}>Decline</Button
				>
				<Button
					class="h-10 flex-1 rounded-xl px-5 sm:flex-none"
					disabled={busy === invitation._id}
					onclick={() => respond(invitation._id, true)}>Join the band</Button
				>
			</div>
		</li>
	{:else}
		<li in:fade class="rounded-2xl bg-card/60 p-10 text-center text-muted-foreground">
			No invitations right now. When someone adds you to their band, it shows up here.
		</li>
	{/each}
</ul>
