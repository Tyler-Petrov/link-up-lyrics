<script lang="ts">
	import { fade } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import { api } from '#convex/_generated/api.js';
	import { ccliLicenseSchema } from '#convex/forms/ccli.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	const user = $derived(await convexQuery(api.user.me, {}));
	let saved = $state(false);
	const form = createConvexForm({
		schema: ccliLicenseSchema,
		mutation: api.ccli.updateLicenseNumber,
		initialData: () => ({ ccliLicenseNumber: user.ccliLicenseNumber ?? '' }),
		afterSuccessfulSubmit: () => {
			saved = true;
			setTimeout(() => (saved = false), 2000);
		}
	});
</script>

<form
	class="flex flex-col gap-2"
	onsubmit={form.onsubmit}
	onfocusout={form.onfocusout}
	oninput={form.oninput}
>
	<Label for="ccli-license">Your church’s CCLI license number</Label>
	<div class="flex gap-2">
		<Input
			id="ccli-license"
			name="ccliLicenseNumber"
			inputmode="numeric"
			autocomplete="off"
			placeholder="e.g. 1234567"
			bind:value={form.data.ccliLicenseNumber}
			aria-invalid={form.errors.ccliLicenseNumber ? true : undefined}
			class="h-10 max-w-56 rounded-xl font-chart"
		/>
		<Button
			type="submit"
			variant="secondary"
			class="h-10 w-24 rounded-xl"
			disabled={!form.isTainted || form.submissionState === 'submitting'}
		>
			{#if saved}
				<span in:fade={{ duration: 120 }} class="inline-flex items-center gap-1"
					><Check /> Saved</span
				>
			{:else}
				Save
			{/if}
		</Button>
	</div>
	<p class="min-h-5 text-sm text-destructive">{form.errors.ccliLicenseNumber?.[0] ?? ''}</p>
</form>
