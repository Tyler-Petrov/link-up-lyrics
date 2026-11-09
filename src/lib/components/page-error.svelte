<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { getAccount } from '#lib/account.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { errorMessage } from '#lib/errors.js';
	import { appear } from '#lib/motion.js';

	/* The one error card: page boundaries' `failed` snippet and the app's error page (routes/+error.svelte). */
	type Props = {
		title?: string;
		/** Defaults to the error's own words when it has some for people. */
		message?: string;
		error?: unknown;
		/** Shows "Try again", which calls this. */
		retry?: () => void;
		/** A boundary's reset, so going to another page leaves the error behind. */
		reset?: () => void;
	};
	let { title = 'That didn’t load', message, error, retry, reset }: Props = $props();

	const account = getAccount();

	const failedAt = page.url.pathname;
	afterNavigate(({ to }) => {
		if (to?.url.pathname !== failedAt) reset?.();
	});
</script>

<!-- The app's not-found look (see the song page), so every dead end reads the same. -->
<div in:appear class="flex flex-col items-center gap-4 pt-10 text-center">
	<h1 class="page-title">{title}</h1>
	<p class="max-w-md text-balance text-muted-foreground">
		{message ??
			errorMessage(error, 'Try again. If the app was just updated, reloading the page fixes it.')}
	</p>
	<div class="flex flex-wrap justify-center gap-2">
		{#if retry}
			<Button class="rounded-xl" onclick={retry}>
				<RotateCcw />
				Try again
			</Button>
		{/if}
		<Button href={account.isSignedIn ? '/library' : '/'} variant="secondary" class="rounded-xl">
			{account.isSignedIn ? 'Back to your library' : 'Go to the home page'}
		</Button>
	</div>
</div>
