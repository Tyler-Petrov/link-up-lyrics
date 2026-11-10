<script lang="ts">
	import { goto } from '$app/navigation';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import Settings from '@lucide/svelte/icons/settings-2';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { api } from '#convex/_generated/api.js';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import { CopyrightSources, KeyModes, MusicalKeys, constantByTag } from '#convex/constants.js';
	import { songMetadataSchema } from '#convex/forms/song.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import { errorMessage } from '#lib/errors.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import { reveal } from '#lib/motion.js';
	import { Advanced } from '#lib/components/ui/advanced/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	/** Title, artist, key, capo and copyright, through song.updateMetadata; and deleting the song. */
	let { song }: { song: Doc<'Song'> } = $props();

	const client = useConvexClient();
	const form = createConvexForm({
		schema: songMetadataSchema,
		mutation: api.song.updateMetadata,
		initialData: () => ({
			songId: song._id,
			title: song.title,
			artist: song.artist ?? '',
			originalKeyTag: song.originalKeyTag,
			capo: song.capo,
			copyrightSourceTag: song.copyrightSourceTag,
			ccliSongNumber: song.ccliSongNumber ?? '',
			copyrightLine: song.copyrightLine ?? '',
			songwriters: song.songwriters
		})
	});

	/* Typed as text; the form holds the list. */
	let songwriters = $state('');
	function open() {
		form.resetOpen();
		songwriters = song.songwriters.join(', ');
	}

	/** What's under "Copyright & credits", so it can stay closed. */
	const credits = $derived.by(() => {
		const { copyrightSourceTag: source, ccliSongNumber, songwriters = [] } = form.data;
		const parts = [
			source === 'ccli' && ccliSongNumber
				? `CCLI #${ccliSongNumber}`
				: source && source !== 'unknown' && constantByTag('CopyrightSources', source).name,
			songwriters.length &&
				`${songwriters.length} ${songwriters.length === 1 ? 'songwriter' : 'songwriters'}`
		].filter(Boolean);
		return parts.length ? parts.join(' · ') : 'Not set';
	});

	/* To the library first, so the page doesn't show "Song not found" on its way out; the song then leaves the list. */
	async function deleteSong() {
		const confirmed = await confirmation({
			title: 'Delete song',
			message: `“${song.title}” and all its blocks will be deleted. Setlists that use it will lose it.`,
			confirmLabel: 'Delete song'
		});
		if (!confirmed) return;
		const { _id: songId, title } = song;
		await goto('/library');
		try {
			await client.mutation(api.song.remove, { songId });
			toast.success(`Deleted “${title}”`);
		} catch (error) {
			console.error(error);
			toast.error(errorMessage(error, 'Couldn’t delete the song. Try again.'));
		}
	}

	/** Native selects, sized and rounded like the Inputs beside them. */
	const selectClass =
		'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';
</script>

<Dialog.Root bind:open={form.state.open}>
	<Button variant="secondary" class="h-10 rounded-xl px-4" onclick={open}>
		<Settings /> Details
	</Button>
	<Dialog.Content class="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Song details</Dialog.Title>
			<Dialog.Description
				>Shown above the chart, and on the church’s usage report.</Dialog.Description
			>
		</Dialog.Header>
		<form
			class="flex flex-col gap-4"
			onsubmit={form.onsubmit}
			onfocusout={form.onfocusout}
			oninput={form.oninput}
		>
			<!-- Spacing as padding, so an error line slides open instead of a gap appearing at once. -->
			<div class="flex flex-col">
				<Label for="song-title" class="pb-2">Title</Label>
				<Input
					id="song-title"
					name="title"
					bind:value={form.data.title}
					aria-invalid={form.errors.title ? true : undefined}
				/>
				{#if form.errors.title}
					<p class="pt-2 text-sm text-destructive" transition:reveal>{form.errors.title[0]}</p>
				{/if}
			</div>
			<div class="flex flex-col gap-2">
				<Label for="song-artist">Artist</Label>
				<Input id="song-artist" name="artist" bind:value={form.data.artist} />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-2">
					<Label for="song-key">Key</Label>
					<select
						id="song-key"
						name="originalKeyTag"
						class={selectClass}
						bind:value={
							() => form.data.originalKeyTag ?? '',
							(v) => (form.data.originalKeyTag = v || undefined)
						}
					>
						<option value="">Not set</option>
						{#each KeyModes as mode (mode.tag)}
							<optgroup label={mode.name}>
								{#each MusicalKeys.filter((key) => key.modeTag === mode.tag) as key (key.tag)}
									<option value={key.tag}>{key.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="song-capo">Capo</Label>
					<Input
						id="song-capo"
						name="capo"
						type="number"
						min="0"
						max="12"
						inputmode="numeric"
						placeholder="None"
						bind:value={
							() => form.data.capo ?? '',
							(v) => (form.data.capo = v === '' || v == null ? undefined : Number(v))
						}
						aria-invalid={form.errors.capo ? true : undefined}
					/>
				</div>
			</div>
			<Advanced label="Copyright & credits · {credits}">
				<div class="flex flex-col">
					<Label for="song-copyright-source" class="pb-2">Copyright</Label>
					<select
						id="song-copyright-source"
						name="copyrightSourceTag"
						class={selectClass}
						bind:value={form.data.copyrightSourceTag}
					>
						{#each CopyrightSources as source (source.tag)}
							<option value={source.tag}>{source.name}</option>
						{/each}
					</select>
					{#if form.data.copyrightSourceTag === 'ccli'}
						<div class="flex flex-col gap-2 pt-3" transition:reveal>
							<Label for="song-ccli">CCLI song number</Label>
							<Input
								id="song-ccli"
								name="ccliSongNumber"
								inputmode="numeric"
								bind:value={form.data.ccliSongNumber}
							/>
						</div>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="song-copyright-line">Copyright line</Label>
					<Input
						id="song-copyright-line"
						name="copyrightLine"
						placeholder="© 2004 sixsteps Music"
						bind:value={form.data.copyrightLine}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="song-songwriters">Songwriters</Label>
					<Input
						id="song-songwriters"
						name="songwriters"
						placeholder="Separate names with commas"
						bind:value={songwriters}
						oninput={() => {
							form.data.songwriters = songwriters
								.split(',')
								.map((name) => name.trim())
								.filter(Boolean);
						}}
					/>
				</div>
			</Advanced>
			<Dialog.Footer>
				<Button
					variant="ghost"
					class="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
					onclick={deleteSong}
				>
					<Trash /> Delete song
				</Button>
				<Button type="submit" class="rounded-xl" disabled={form.submissionState === 'submitting'}>
					{form.submissionState === 'submitting' ? 'Saving…' : 'Save details'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
