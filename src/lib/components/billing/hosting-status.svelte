<script lang="ts">
	/*
	 * The signed-in person's hosting status, one line. Mount it for the session OWNER only (billing is between us
	 * and them), next to "Go live", and not while a session is live. Says the date, not a count. §13.3.3.
	 */
	import { page } from '$app/state';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Gift from '@lucide/svelte/icons/gift';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Lock from '@lucide/svelte/icons/lock';
	import { api } from '#convex/_generated/api.js';
	import { canHost, DAY, effectivePlanTag } from '#convex/model/billing.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();

	const user = $derived(await convexQuery(api.user.me, {}));
	const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
	const longDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	const status = $derived.by(() => {
		const now = Date.now();
		const plan = effectivePlanTag(user, now);
		if (!canHost(user, now)) {
			return {
				tone: 'blocked',
				icon: Lock,
				text:
					user.planTag === 'expired'
						? 'Your plan has ended. Subscribe to host again.'
						: 'Hosting needs a plan. Start a 14-day free trial, no card needed.',
				action: 'See plans'
			} as const;
		}
		const comped = (user.compedUntilEpoch ?? 0) > now;
		if (user.paymentStatusTag === 'pastDue' && user.graceEndsEpoch && !comped) {
			const urgent = user.graceEndsEpoch - now <= 3 * DAY;
			const by = date.format(user.graceEndsEpoch);
			return {
				tone: urgent ? 'urgent' : 'notice',
				icon: CircleAlert,
				text: urgent
					? `Your card didn’t go through. Update it by ${by} to keep hosting.`
					: `Your card didn’t go through. Everything still works; update it by ${by}.`,
				action: 'Update card'
			} as const;
		}
		if (comped)
			return {
				tone: 'ok',
				icon: Gift,
				text: `Free hosting until ${longDate.format(user.compedUntilEpoch)}`
			} as const;
		return {
			tone: 'ok',
			icon: Sparkles,
			text:
				plan === 'pro'
					? 'Pro'
					: user.trialEndsEpoch
						? `Free trial ends ${date.format(user.trialEndsEpoch)}`
						: 'Free trial'
		} as const;
	});
</script>

<p
	class={cn(
		'inline-flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-snug',
		status.tone === 'ok' && 'bg-accent/60 text-muted-foreground',
		status.tone === 'notice' && 'bg-primary/15 text-foreground',
		status.tone === 'urgent' && 'bg-destructive/20 text-foreground',
		status.tone === 'blocked' && 'bg-secondary text-foreground',
		className
	)}
>
	<status.icon
		class={cn(
			'mt-0.5 size-4 shrink-0',
			status.tone === 'urgent' ? 'text-destructive' : 'text-primary'
		)}
	/>
	<span>
		{status.text}
		{#if 'action' in status && page.url.pathname !== '/account'}
			<a
				href="/account"
				class="ml-1 font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
				>{status.action}</a
			>
		{/if}
	</span>
</p>
