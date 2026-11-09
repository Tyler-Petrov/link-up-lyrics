<script lang="ts">
	import { SignIn } from 'svelte-clerk/client';
	import { getAccount } from '#lib/account.svelte.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import TrialBanner from '#lib/components/billing/trial-banner.svelte';
	import { appear } from '#lib/motion.js';

	// Pages that need an account. Signed out, they show Clerk's sign-in in place and carry on after it.
	let { children } = $props();
	const account = getAccount();

	// The page's heading already says what to do, so Clerk's card leaves out its own.
	const signInAppearance = { elements: { header: { display: 'none' } } };
</script>

{#if account.isReady}
	<div in:appear>
		<TrialBanner />
		{@render children()}
	</div>
{:else if account.isSignedIn}
	<div in:appear>
		<Skeleton class="mx-auto h-40 w-full rounded-2xl" />
	</div>
{:else}
	<div class="flex flex-col items-center gap-6">
		<h1 class="page-title">Sign in to continue</h1>
		<!-- A card-sized placeholder until Clerk draws the card into its host div (fading in, app.css), so
		     nothing jumps. -->
		<div class="group grid w-full max-w-[25rem] justify-items-center *:[grid-area:1/1]">
			<Skeleton
				class="h-56 w-full rounded-3xl transition-[visibility] delay-200 group-has-[>div>*]:invisible"
			/>
			<SignIn routing="hash" appearance={signInAppearance} />
		</div>
	</div>
{/if}
