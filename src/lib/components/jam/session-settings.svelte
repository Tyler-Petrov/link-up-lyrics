<script lang="ts">
	import { goto } from '$app/navigation';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { api } from '#convex/_generated/api.js';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import { renameJamSessionSchema } from '#convex/forms/jam_session.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	/* Owner-only: rename and delete. */
	let { session }: { session: Doc<'JamSession'> } = $props();

	const client = useConvexClient();
	const form = createConvexForm({
		schema: renameJamSessionSchema,
		mutation: api.jam_session.rename,
		initialData: () => ({ jamSessionId: session._id, name: session.name })
	});

	/*
	 * Leaves the console first, then deletes: the console's queries never run against a session that's gone, and
	 * the session slides out of the list you land on.
	 */
	async function remove() {
		const { _id: jamSessionId, name } = session;
		const confirmed = await confirmation({
			title: 'Delete jam session',
			message: `“${name}” and its setlist will be deleted, and its QR code will stop working. Your songs stay in your library.`,
			confirmLabel: 'Delete session'
		});
		if (!confirmed) return;
		await goto('/jams');
		try {
			await client.mutation(api.jam_session.remove, { jamSessionId });
			toast.success(`Deleted “${name}”`);
		} catch (error) {
			toast.error(errorMessage(error, 'Couldn’t delete the session. Try again.'));
		}
	}
</script>

<div class="flex items-center gap-1">
	<Dialog.Root bind:open={form.state.open}>
		<Button
			variant="ghost"
			size="icon"
			class="rounded-xl text-muted-foreground"
			aria-label="Rename session"
			onclick={() => form.resetOpen()}
		>
			<Pencil />
		</Button>
		<Dialog.Content class="rounded-2xl">
			<Dialog.Header>
				<Dialog.Title>Rename session</Dialog.Title>
			</Dialog.Header>
			<form
				class="flex flex-col gap-4"
				onsubmit={form.onsubmit}
				onfocusout={form.onfocusout}
				oninput={form.oninput}
			>
				<div class="flex flex-col gap-2">
					<Label for="session-name">Name</Label>
					<Input
						id="session-name"
						name="name"
						bind:value={form.data.name}
						aria-invalid={form.errors.name ? true : undefined}
					/>
					<p class="min-h-5 text-sm text-destructive">{form.errors.name?.[0] ?? ''}</p>
				</div>
				<Dialog.Footer>
					<Button type="submit" class="rounded-xl" disabled={form.submissionState === 'submitting'}>
						Save name
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Button
		variant="ghost"
		size="icon"
		class="rounded-xl text-muted-foreground hover:text-destructive"
		aria-label="Delete session"
		onclick={remove}
	>
		<Trash />
	</Button>
</div>
