<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { api } from '#convex/_generated/api.js';
	import { ccliLicenseSchema } from '#convex/forms/ccli.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import { appear } from '#lib/motion.js';
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
	const error = $derived(form.errors.ccliLicenseNumber?.[0]);
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
			aria-invalid={error ? true : undefined}
			aria-describedby="ccli-license-status"
			class="h-10 max-w-56 rounded-xl font-chart"
		/>
		<Button
			type="submit"
			variant="secondary"
			class="h-10 rounded-xl px-5"
			disabled={!form.isTainted || form.submissionState === 'submitting'}
		>
			Save
		</Button>
	</div>
	<!-- One reserved row for what's happening to the number; the messages crossfade in place. -->
	<p id="ccli-license-status" role="status" class="grid min-h-5 text-sm *:[grid-area:1/1]">
		{#if error}
			<span transition:appear class="text-destructive">{error}</span>
		{:else if form.submissionState === 'submitting'}
			<span transition:appear class="text-muted-foreground">Saving…</span>
		{:else if saved}
			<span transition:appear class="inline-flex items-center gap-1 text-success">
				<Check class="size-4" /> Saved
			</span>
		{/if}
	</p>
</form>
