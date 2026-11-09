<script lang="ts">
	import { SignIn } from 'svelte-clerk/client';
	import { getAccount } from '#lib/account.svelte.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	// Pages that need an account. Signed out, they show Clerk's sign-in in place and carry on after it.
	let { children } = $props();
	const account = getAccount();
</script>

{#if account.isReady}
	{@render children()}
{:else if account.isSignedIn}
	<Skeleton class="mx-auto h-40 w-full rounded-2xl" />
{:else}
	<div class="flex flex-col items-center gap-6">
		<h1 class="page-title">Sign in to continue</h1>
		<SignIn routing="hash" />
	</div>
{/if}
