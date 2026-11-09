<script lang="ts">
	import { page } from '$app/state';
	import { SignInButton, UserButton } from 'svelte-clerk/client';
	import { toggleMode } from 'mode-watcher';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import Music from '@lucide/svelte/icons/music-4';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getAccount } from '#lib/account.svelte.js';
	import { cn } from '#lib/utils.js';
	import InvitationBadge from '#lib/components/band/invitation-badge.svelte';

	const account = getAccount();

	const links = [
		{ href: '/library', label: 'Library' },
		{ href: '/jams', label: 'Jams' },
		{ href: '/invitations', label: 'Invitations', badge: true }
	];
	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<!-- A floating rounded card, like the old app's header. -->
<header
	class="sticky top-3 z-40 mx-auto flex w-[min(100%-1.5rem,64rem)] items-center gap-2 rounded-2xl bg-card/85 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-md sm:gap-4 sm:px-4"
>
	<a href="/" class="flex shrink-0 items-center gap-2 rounded-lg font-[750] tracking-tight">
		<span class="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
			<Music class="size-4" />
		</span>
		<span class="hidden sm:inline">Link Up Lyrics</span>
	</a>

	{#if account.isSignedIn}
		<nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={isActive(link.href) ? 'page' : undefined}
					class={cn(
						'relative rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
						isActive(link.href) && 'bg-accent text-foreground'
					)}
				>
					{link.label}
					{#if link.badge && account.isReady}
						<InvitationBadge />
					{/if}
				</a>
			{/each}
		</nav>
	{:else}
		<div class="flex-1"></div>
	{/if}

	<Button
		variant="ghost"
		size="icon"
		onclick={toggleMode}
		aria-label="Toggle light and dark mode"
		class="rounded-xl"
	>
		<Sun class="hidden dark:block" />
		<Moon class="dark:hidden" />
	</Button>

	<!-- Fixed height so the header doesn't jump while Clerk loads the avatar. -->
	<div class="grid h-8 min-w-8 shrink-0 place-items-center">
		{#if account.isSignedIn}
			<UserButton />
		{:else}
			<SignInButton mode="modal" asChild>
				{#snippet children({ signIn }: { signIn: () => void })}
					<Button size="sm" class="rounded-xl" onclick={signIn}>Sign in</Button>
				{/snippet}
			</SignInButton>
		{/if}
	</div>
</header>
