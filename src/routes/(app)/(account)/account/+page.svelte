<script lang="ts">
	import { PricingTable, useClerkContext } from 'svelte-clerk/client';
	import { PUBLIC_CLERK_BILLING_ENABLED } from '$app/env/public';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import { api } from '#convex/_generated/api.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import HostingStatus from '#lib/components/billing/hosting-status.svelte';
	import CcliLicenseForm from '#lib/components/account/ccli-license-form.svelte';
	import UsageReport from '#lib/components/account/usage-report.svelte';

	const user = $derived(await convexQuery(api.user.me, {}));
	const clerk = useClerkContext();
</script>

<svelte:head>
	<title>Account · Link Up Lyrics</title>
</svelte:head>

<h1 class="page-title">Account</h1>

<div class="mt-8 flex flex-col gap-5">
	<section class="card-section flex flex-wrap items-center gap-4">
		{#if user.imageUrl}
			<img src={user.imageUrl} alt="" class="size-14 rounded-2xl object-cover" />
		{/if}
		<div class="min-w-0 flex-1 basis-40">
			<p class="truncate text-lg font-semibold">{user.name}</p>
			<p class="truncate text-sm text-muted-foreground">{user.email}</p>
		</div>
		<Button
			variant="secondary"
			class="h-10 w-full rounded-xl sm:w-auto"
			disabled={!clerk.clerk}
			onclick={() => clerk.clerk?.openUserProfile()}
		>
			<UserCog /> Manage sign-in and profile
		</Button>
	</section>

	<section class="card-section flex flex-col gap-4">
		<header>
			<h2 class="section-title">Hosting</h2>
			<p class="section-lede">
				You pay to host: creating jam sessions, going live, and inviting your band. Your library,
				and being in someone else’s band, are always free. $1.99 a month or $20 a year, with a
				14-day free trial and no card needed. A plan buys the tool, never any rights to the songs.
			</p>
		</header>
		<HostingStatus class="self-start" />
		{#if PUBLIC_CLERK_BILLING_ENABLED}
			<PricingTable />
		{/if}
	</section>

	<section class="card-section flex flex-col gap-4">
		<header>
			<h2 class="section-title">CCLI</h2>
			<p class="section-lede">
				If your church holds a CCLI Church Copyright License, your small group is almost certainly
				covered by it, and your church reports the songs you use. Add the number so it’s on hand.
			</p>
		</header>
		<CcliLicenseForm />
	</section>

	<section class="card-section flex flex-col gap-4">
		<header>
			<h2 class="section-title">Song usage</h2>
			<p class="section-lede">
				Every song you’ve shown live, by date. Hand the CSV to whoever files your church’s CCLI
				report{user.ccliLicenseNumber ? ` (license ${user.ccliLicenseNumber})` : ''}.
			</p>
		</header>
		<UsageReport />
	</section>

	<p class="text-center text-sm text-muted-foreground">
		<a href="/legal" class="underline-offset-4 hover:underline">Terms, copyright and takedowns</a>
	</p>
</div>

<style>
	.card-section {
		border-radius: 1rem;
		background: var(--card);
		padding: 1.25rem;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
	}
	.section-title {
		font-size: 1.125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.section-lede {
		margin-top: 0.25rem;
		max-width: 42rem;
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}
</style>
