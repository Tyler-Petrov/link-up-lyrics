<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { api } from '#convex/_generated/api.js';
	import { atTagOrHigher, constantByTag } from '#convex/constants.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import NewSessionDialog from '#lib/components/jam/new-session-dialog.svelte';

	const sessions = $derived(await convexQuery(api.jam_session.listMine, {}));
</script>

<svelte:head>
	<title>Jams · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Your Jam Sessions</h1>

<div class="mt-8 flex justify-center">
	<NewSessionDialog />
</div>

<ul class="mt-8 grid gap-3 sm:grid-cols-2">
	{#each sessions as session (session._id)}
		{@const canLead = atTagOrHigher('JamSessionRoles', session.roleTag, 'leader')}
		<li animate:flip={{ duration: 200 }} in:fade={{ duration: 150 }}>
			<!-- Leaders open the console; players go where the music is. -->
			<a
				href={canLead ? `/jams/${session._id}` : `/live/${session._id}`}
				class="group flex min-h-24 items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-sm shadow-black/10 transition-colors hover:bg-accent"
			>
				<div class="flex min-w-0 flex-1 flex-col gap-2">
					<p class="truncate text-lg font-semibold">{session.name}</p>
					<div class="flex items-center gap-2 text-xs">
						{#if session.isLive}
							<span
								class="flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary"
							>
								<span class="size-1.5 animate-pulse rounded-full bg-primary"></span> Live
							</span>
						{/if}
						<span class="rounded-full bg-background/50 px-2 py-0.5 text-muted-foreground">
							{session.roleTag === 'owner'
								? 'Yours'
								: constantByTag('JamSessionRoles', session.roleTag).name}
						</span>
					</div>
				</div>
				<ChevronRight
					class="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
				/>
			</a>
		</li>
	{:else}
		<li class="rounded-2xl bg-card/60 p-10 text-center text-muted-foreground sm:col-span-2">
			No sessions yet. Start one, add songs from your library, and share its QR code with the room.
		</li>
	{/each}
</ul>
