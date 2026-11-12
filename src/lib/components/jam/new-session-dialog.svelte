<script lang="ts">
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import { api } from '#convex/_generated/api.js';
	import { createJamSessionSchema } from '#convex/forms/jam_session.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	const form = createConvexForm({
		schema: createJamSessionSchema,
		mutation: api.jam_session.create,
		// An empty name rather than none, so submitting it says the schema's own "Give the session a name".
		initialData: () => ({ name: '' }),
		afterSuccessfulSubmit: async ({ response: jamSessionId }) => {
			await goto(`/jams/${jamSessionId}`);
		}
	});
</script>

<Dialog.Root bind:open={form.state.open}>
	<Button class="h-10 rounded-xl px-4" onclick={() => form.resetOpen()}>
		<Plus /> New jam session
	</Button>
	<Dialog.Content class="rounded-2xl">
		<Dialog.Header>
			<Dialog.Title>New jam session</Dialog.Title>
			<Dialog.Description>
				One session can run every week. Its QR code stays the same, so you can print it.
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="flex flex-col gap-4"
			onsubmit={form.onsubmit}
			onfocusout={form.onfocusout}
			oninput={form.oninput}
		>
			<div class="flex flex-col gap-2">
				<Label for="new-session-name">Name</Label>
				<Input
					id="new-session-name"
					name="name"
					bind:value={form.data.name}
					placeholder="Wednesday small group"
					aria-invalid={form.errors.name ? true : undefined}
				/>
				<p class="min-h-5 text-sm text-destructive">{form.errors.name?.[0] ?? ''}</p>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="rounded-xl" disabled={form.submissionState === 'submitting'}>
					{form.submissionState === 'submitting' ? 'Creating…' : 'Create session'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
