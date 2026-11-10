<script lang="ts">
	import { goto } from '$app/navigation';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import { api } from '#convex/_generated/api.js';
	import { createSongFromTextSchema } from '#convex/forms/song.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';

	const form = createConvexForm({
		schema: createSongFromTextSchema,
		mutation: api.song.createFromText,
		// So an empty submit says "Paste the song's words", not that the field is missing.
		initialData: () => ({ text: '' }),
		afterSuccessfulSubmit: async ({ response: songId }) => {
			await goto(`/songs/${songId}`);
		}
	});
	/* Opens with "For example" and stays dim, so it reads as a hint and not as words already pasted in. */
	const placeholder = `For example:

Verse 1
[G]Amazing [G7]grace, how [C]sweet the [G]sound

Chorus
G        C      G
Chords above the words work too`;
</script>

<Dialog.Root bind:open={form.state.open}>
	<Button class="h-10 rounded-xl px-4" onclick={() => form.resetOpen()}>
		<ClipboardPaste /> Paste a song
	</Button>
	<Dialog.Content class="rounded-2xl sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Paste a song</Dialog.Title>
			<Dialog.Description>
				Blank lines split blocks. A block’s first line names it (“Chorus”, “[Verse 2]”). Chords go
				in brackets, <code>[G]Amazing</code>, or on the line above the words. ChordPro works too.
			</Dialog.Description>
		</Dialog.Header>
		<form
			class="flex flex-col gap-4"
			onsubmit={form.onsubmit}
			onfocusout={form.onfocusout}
			oninput={form.oninput}
		>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-2">
					<Label for="paste-title">Title</Label>
					<Input
						id="paste-title"
						name="title"
						bind:value={form.data.title}
						placeholder="Untitled song if blank"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="paste-artist">Artist</Label>
					<Input id="paste-artist" name="artist" bind:value={form.data.artist} />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="paste-text">Words and chords</Label>
				<Textarea
					id="paste-text"
					name="text"
					bind:value={form.data.text}
					rows={14}
					class="font-chart placeholder:text-muted-foreground/50"
					{placeholder}
					aria-invalid={form.errors.text ? true : undefined}
				/>
				<p class="min-h-5 text-sm text-destructive">{form.errors.text?.[0] ?? ''}</p>
			</div>
			<Dialog.Footer>
				<Button type="submit" class="rounded-xl" disabled={form.submissionState === 'submitting'}>
					{form.submissionState === 'submitting' ? 'Creating…' : 'Create song'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
