<script lang="ts">
	import { tick } from 'svelte';
	import { crossfade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { navigating, page } from '$app/state';
	import { SignInButton, UserButton } from 'svelte-clerk/client';
	import { toggleMode } from 'mode-watcher';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import Music from '@lucide/svelte/icons/music-4';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getAccount } from '#lib/account.svelte.js';
	import { useConnection } from '#lib/connection.svelte.js';
	import { appear, ms, reduced } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import InvitationBadge from '#lib/components/band/invitation-badge.svelte';

	const account = getAccount();
	const connection = useConnection();

	const links = [
		// Songs are opened from the Library, so it stays highlighted on them.
		{ href: '/library', label: 'Library', within: ['/library', '/songs'] },
		{ href: '/jams', label: 'Jams', within: ['/jams'] },
		{ href: '/invitations', label: 'Invitations', within: ['/invitations'], badge: true }
	];
	const isActive = (link: (typeof links)[number]) =>
		link.within.some(
			(path) => page.url.pathname === path || page.url.pathname.startsWith(`${path}/`)
		);

	// The active link's pill slides from the old link to the new one.
	const [send, receive] = crossfade({
		duration: () => ms(250),
		easing: cubicOut,
		fallback: appear
	});

	// The whole page crossfades between light and dark, rather than each colour snapping.
	function switchMode() {
		if (reduced() || !document.startViewTransition) return toggleMode();
		document.startViewTransition(async () => {
			toggleMode();
			await tick();
		});
	}
</script>

<!-- A floating rounded card, like the old app's header. Named so it holds still while pages crossfade. -->
<header
	class="sticky top-3 z-40 mx-auto flex w-[min(100%-1.5rem,64rem)] items-center gap-1.5 rounded-2xl bg-card/85 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-md [view-transition-name:header] sm:gap-4 sm:px-4"
>
	<a href="/" class="flex shrink-0 items-center gap-2 rounded-lg font-[750] tracking-tight">
		<!-- The mark is always the dark tile with an amber note, like the favicon: music, not a control. -->
		<span class="dark grid size-8 place-items-center rounded-xl bg-secondary text-chord">
			<Music class="size-4" />
		</span>
		<span class="hidden sm:inline">Link Up Lyrics</span>
	</a>

	{#if account.isSignedIn}
		<!-- Tight on phones so all three fit beside the controls; it scrolls only as a last resort. -->
		<nav class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1">
			{#each links as link (link.href)}
				{@const active = isActive(link)}
				<a
					href={link.href}
					aria-current={active ? 'page' : undefined}
					class={cn(
						'relative isolate shrink-0 rounded-xl px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground max-[380px]:text-[0.8125rem] sm:px-3',
						active && 'text-foreground'
					)}
				>
					{#if active}
						<span
							class="absolute inset-0 -z-10 rounded-xl bg-accent"
							in:receive={{ key: 'active' }}
							out:send={{ key: 'active' }}
						></span>
					{/if}
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
		onclick={switchMode}
		aria-label="Switch between light and dark"
		class="rounded-xl"
	>
		<Sun class="hidden dark:block" />
		<Moon class="dark:hidden" />
	</Button>

	<!-- Fixed size so the header doesn't jump while Clerk loads the avatar. -->
	<div class="grid h-8 min-w-8 shrink-0 place-items-center">
		{#if account.isSignedIn}
			<UserButton>
				<UserButton.MenuItems>
					<!-- /account: plan, CCLI number and usage report. Clerk's own item manages sign-in. -->
					<UserButton.Link label="Plan & CCLI" href="/account" labelIcon={accountIcon} />
				</UserButton.MenuItems>
			</UserButton>
		{:else}
			<SignInButton mode="modal" asChild>
				{#snippet children({ signIn }: { signIn: () => void })}
					<Button size="sm" class="rounded-xl" onclick={signIn}>Sign in</Button>
				{/snippet}
			</SignInButton>
		{/if}
	</div>

	<!-- A page that takes a moment to load: shown only after 150ms, so quick ones never flash it. -->
	<div
		aria-hidden="true"
		class={cn(
			'pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full opacity-0 transition-opacity duration-200',
			navigating.to && 'opacity-100 delay-150'
		)}
	>
		<div
			class={cn(
				'nav-progress h-full w-1/3 rounded-full bg-primary',
				!navigating.to && '[animation-play-state:paused]'
			)}
		></div>
	</div>

	<!-- Hangs under the header, so it never pushes the nav around. -->
	<div role="status" class="absolute top-full left-1/2 mt-2 -translate-x-1/2">
		{#if connection.reconnecting}
			<p
				transition:appear
				class="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground shadow-md shadow-black/20"
				title="Changes you make wait, and the page catches up once the connection is back."
			>
				<WifiOff class="size-3.5" />
				Reconnecting…
			</p>
		{/if}
	</div>
</header>

{#snippet accountIcon()}
	<CreditCard class="size-4" />
{/snippet}

<style>
	.nav-progress {
		animation: nav-progress 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite;
	}
	@keyframes nav-progress {
		from {
			translate: -100% 0;
		}
		to {
			translate: 300% 0;
		}
	}
</style>
