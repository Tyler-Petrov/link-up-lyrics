<script lang="ts">
	/*
	 * The band: who plays with chords in this session. The owner invites by email, removes, or cancels an
	 * invitation, and under Advanced makes members leaders; leaders see the list. Members are free, and there's
	 * no limit. §14.2–14.3.
	 */
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Crown from '@lucide/svelte/icons/crown';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import X from '@lucide/svelte/icons/x';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { inviteSchema } from '#convex/forms/invitation.js';
	import { canHost } from '#convex/model/billing.js';
	import { constantByTag } from '#convex/constants.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import { glide, reveal } from '#lib/motion.js';
	import { Advanced } from '#lib/components/ui/advanced/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import HostingStatus from '#lib/components/billing/hosting-status.svelte';
	import { cn } from '#lib/utils.js';

	let { jamSessionId }: { jamSessionId: Id<'JamSession'> } = $props();

	// Null once the session is deleted or you stop leading it; the console then shows "Session not found".
	const band = $derived(await convexQuery(api.invitation.listForSession, { jamSessionId }));
	// Only the owner manages the band, and inviting follows their plan (they're the signed-in person then).
	const me = $derived(band?.canManage ? await convexQuery(api.user.me, {}) : undefined);
	const canInvite = $derived(me !== undefined && canHost(me, Date.now()));
	const accepted = $derived(
		band?.members.filter((member) => member.statusTag === 'accepted') ?? []
	);

	const client = useConvexClient();
	const form = createConvexForm({
		schema: inviteSchema,
		mutation: api.invitation.invite,
		initialData: () => ({ jamSessionId, email: '' }),
		afterSuccessfulSubmit: ({ data }) => {
			toast.success(`Invited ${data.email}`);
		}
	});

	async function run(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	}

	type Member = NonNullable<typeof band>['members'][number];
	const label = (member: Member) => member.name ?? member.email ?? 'Invited';

	async function remove(member: Member) {
		const invited = member.statusTag === 'invited';
		const ok = await confirmation({
			title: invited ? 'Cancel invitation' : 'Remove from band',
			message: invited
				? `${label(member)} won’t be able to accept it. You can invite them again later.`
				: `${label(member)} will stop seeing this session’s setlist and chords. You can invite them again later.`,
			confirmLabel: invited ? 'Cancel invitation' : 'Remove',
			cancelLabel: 'Keep'
		});
		if (ok) await run(() => client.mutation(api.invitation.remove, { memberId: member._id }));
	}
</script>

{#snippet avatar(name: string, imageUrl: string | undefined)}
	{#if imageUrl}
		<img src={imageUrl} alt="" class="size-9 shrink-0 rounded-full object-cover" />
	{:else}
		<span
			class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase"
			>{name.slice(0, 1)}</span
		>
	{/if}
{/snippet}

{#if band}
	<section class="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm shadow-black/10 sm:p-5">
		<header class="flex items-baseline justify-between gap-3">
			<h2 class="text-lg font-semibold tracking-tight">Band</h2>
			<p class="text-xs text-muted-foreground">Members see the setlist and chords, free.</p>
		</header>

		<ul class="flex flex-col gap-1">
			<li class="flex items-center gap-3 rounded-xl px-2 py-2">
				{@render avatar(band.owner.name, band.owner.imageUrl)}
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium">{band.owner.name}</p>
					<p class="truncate text-xs text-muted-foreground">{band.owner.email}</p>
				</div>
				<span
					class="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
				>
					<Crown class="size-3" /> Owner
				</span>
			</li>
			{#each band.members as member (member._id)}
				<li
					animate:glide
					transition:reveal
					class="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent/40"
				>
					{@render avatar(label(member), member.imageUrl)}
					<div class="min-w-0 flex-1">
						<p class={cn('truncate font-medium', !member.name && 'text-muted-foreground')}>
							{label(member)}
						</p>
						<p class="truncate text-xs text-muted-foreground">
							{member.statusTag === 'invited'
								? member.userId
									? 'Invited, waiting on them'
									: 'Invited, hasn’t signed up yet'
								: member.email}
						</p>
					</div>
					<span class="rounded-lg bg-secondary px-2 py-0.5 text-xs">
						{member.statusTag === 'invited'
							? 'Invited'
							: constantByTag('JamSessionRoles', member.roleTag).name}
					</span>
					{#if band.canManage}
						<Button
							variant="ghost"
							size="icon-sm"
							class="rounded-lg text-muted-foreground hover:text-destructive"
							aria-label={member.statusTag === 'invited'
								? `Cancel ${label(member)}’s invitation`
								: `Remove ${label(member)}`}
							onclick={() => remove(member)}
						>
							<X />
						</Button>
					{/if}
				</li>
			{:else}
				<li transition:reveal class="px-2 py-1 text-sm text-muted-foreground">
					{band.canManage
						? 'Invite the people who play with you. They’ll see chords on the live page; everyone else sees lyrics.'
						: 'No one else is in the band yet.'}
				</li>
			{/each}
		</ul>

		{#if band.canManage}
			{#if canInvite}
				<form
					class="flex flex-col gap-1"
					onsubmit={form.onsubmit}
					onfocusout={form.onfocusout}
					oninput={form.oninput}
				>
					<div class="flex gap-2">
						<Input
							name="email"
							type="email"
							autocomplete="off"
							inputmode="email"
							placeholder="guitarist@example.com"
							aria-label="Email to invite"
							bind:value={form.data.email}
							aria-invalid={form.errors.email ? true : undefined}
							class="h-10 flex-1 rounded-xl"
						/>
						<Button
							type="submit"
							class="h-10 rounded-xl"
							disabled={form.submissionState === 'submitting'}
						>
							<UserPlus /> Invite
						</Button>
					</div>
					<p class="min-h-5 px-1 text-sm text-destructive">{form.errors.email?.[0] ?? ''}</p>
				</form>
			{:else}
				<HostingStatus />
			{/if}

			{#if accepted.length}
				<Advanced class="-mt-2">
					<p class="text-sm text-muted-foreground">
						Leaders run the setlist and what everyone sees, like you.
					</p>
					<ul class="flex flex-col gap-1">
						{#each accepted as member (member._id)}
							<li class="flex items-center justify-between gap-3" transition:reveal>
								<span class="min-w-0 truncate text-sm">{label(member)}</span>
								<Button
									variant="secondary"
									size="sm"
									class="w-24 rounded-lg"
									onclick={() =>
										run(() =>
											client.mutation(api.invitation.setRole, {
												memberId: member._id,
												roleTag: member.roleTag === 'leader' ? 'player' : 'leader'
											})
										)}
								>
									{member.roleTag === 'leader' ? 'Make player' : 'Make leader'}
								</Button>
							</li>
						{/each}
					</ul>
				</Advanced>
			{/if}
		{/if}
	</section>
{/if}
