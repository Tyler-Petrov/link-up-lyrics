<script lang="ts">
	import { SignInButton } from 'svelte-clerk/client';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Guitar from '@lucide/svelte/icons/guitar';
	import Users from '@lucide/svelte/icons/users';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getAccount } from '#lib/account.svelte.js';

	const account = getAccount();

	const features = [
		{
			icon: Guitar,
			title: 'Chords on the syllable',
			text: 'Every chord sits on the exact letter it’s played on, and transposes with one tap.'
		},
		{
			icon: QrCode,
			title: 'One QR code',
			text: 'The room scans once. Whatever song and verse you’re on, every phone follows.'
		},
		{
			icon: Users,
			title: 'Lyrics for the room, chords for the band',
			text: 'Singers see big, clean words. The people playing see the chart.'
		}
	];
</script>

<section class="flex flex-col items-center gap-6 pt-10 text-center">
	<h1 class="max-w-3xl page-title">Everyone on the same song.</h1>
	<p class="max-w-xl text-lg text-muted-foreground">
		Shared chord charts for small groups and jam sessions. Build your songs once, then lead the
		night from your phone.
	</p>
	<div class="h-11">
		{#if account.isSignedIn}
			<Button href="/library" size="lg" class="h-11 rounded-xl px-6 text-base"
				>Open your library</Button
			>
		{:else}
			<!-- Lands where the button promised, whether they sign in or sign up. -->
			<SignInButton
				mode="modal"
				forceRedirectUrl="/jams"
				signUpForceRedirectUrl="/jams"
				asChild
			>
				{#snippet children({ signIn }: { signIn: () => void })}
					<Button size="lg" class="h-11 rounded-xl px-6 text-base" onclick={signIn}
						>Start a jam</Button
					>
				{/snippet}
			</SignInButton>
		{/if}
	</div>
</section>

<section class="mt-20 grid gap-4 sm:grid-cols-3">
	{#each features as feature (feature.title)}
		<div class="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-md shadow-black/10">
			<feature.icon class="size-6 text-primary" />
			<h2 class="font-[750]">{feature.title}</h2>
			<p class="text-sm text-muted-foreground">{feature.text}</p>
		</div>
	{/each}
</section>
