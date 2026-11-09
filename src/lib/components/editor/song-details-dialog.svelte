<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings-2';
	import { api } from '#convex/_generated/api.js';
	import type { Doc } from '#convex/_generated/dataModel.js';
	import { CopyrightSources, KeyModes, MusicalKeys } from '#convex/constants.js';
	import { songMetadataSchema } from '#convex/forms/song.js';
	import { createConvexForm } from '#lib/form.svelte.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	/** Title, artist, key, capo and copyright, through song.updateMetadata. */
	let { song }: { song: Doc<'Song'> } = $props();

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

	const selectClass =
		'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30';
</script>

<Dialog.Root bind:open={form.state.open}>
	<Button variant="secondary" class="rounded-xl" onclick={open}>
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
			<div class="flex flex-col gap-2">
				<Label for="song-title">Title</Label>
				<Input
					id="song-title"
					name="title"
					bind:value={form.data.title}
					aria-invalid={form.errors.title ? true : undefined}
				/>
				{#if form.errors.title}<p class="text-sm text-destructive">{form.errors.title[0]}</p>{/if}
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
			<div class="flex flex-col gap-2">
				<Label for="song-copyright-source">Copyright</Label>
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
			</div>
			{#if form.data.copyrightSourceTag === 'ccli'}
				<div class="flex flex-col gap-2">
					<Label for="song-ccli">CCLI song number</Label>
					<Input
						id="song-ccli"
						name="ccliSongNumber"
						inputmode="numeric"
						bind:value={form.data.ccliSongNumber}
					/>
				</div>
			{/if}
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
			<Dialog.Footer>
				<Button type="submit" class="rounded-xl" disabled={form.submissionState === 'submitting'}>
					{form.submissionState === 'submitting' ? 'Saving…' : 'Save details'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
