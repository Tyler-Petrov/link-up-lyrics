<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import Group from '@lucide/svelte/icons/group';
	import Ungroup from '@lucide/svelte/icons/ungroup';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import Music from '@lucide/svelte/icons/music';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import type { SortableEvent } from 'sortablejs';
	import type { Id } from '#convex/_generated/dataModel.js';
	import type { SongArrangement } from '#convex/model/song.js';
	import {
		groupArrangement,
		orderBetween,
		ordersBetween,
		type ArrangementBlock
	} from '#lib/chart/index.js';
	import { sortable } from '#lib/sortable.js';
	import { cn } from '#lib/utils.js';
	import BlockEditor from './block-editor.svelte';
	import ChordPicker from './chord-picker.svelte';
	import { SongEditorState, setSongEditor, type ChordEntryMode } from './editor.svelte.js';

	/*
	 * The owner's editor for a song (plan M3): blocks, interludes and loose lines in one draggable order,
	 * lines edited in place, chords by picker or brackets, and line groups made by selecting lines.
	 */
	type Props = {
		/** The URL's song id, which getArrangement was called with (optimistic updates patch that query). */
		routeSongId: string;
		arrangement: SongArrangement;
	};
	let { routeSongId, arrangement }: Props = $props();

	// svelte-ignore state_referenced_locally
	const editor = setSongEditor(new SongEditorState(routeSongId, arrangement.song._id));

	const blocks = $derived(arrangement.blocks);
	const groups = $derived(groupArrangement(blocks));

	const modes: { value: ChordEntryMode; label: string; hint: string }[] = [
		{ value: 'picker', label: 'Tap chords', hint: 'Tap above a letter to pick a chord' },
		{ value: 'brackets', label: 'Brackets', hint: 'Type chords in brackets: [G]Amazing [G7]grace' }
	];

	/* ---------- Reorder: blocks and loose-line runs share the song's order space ---------- */

	const firstOrder = (block: ArrangementBlock) =>
		block.type === 'section' ? block.section.order : block.lines[0]!.order;
	const lastOrder = (block: ArrangementBlock) =>
		block.type === 'section' ? block.section.order : block.lines.at(-1)!.order;

	async function onReorder(event: SortableEvent) {
		const { oldIndex, newIndex, item, from } = event;
		if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
		// Put the dragged node back, so Svelte moves it (and flips it) from the data instead.
		item.remove();
		from.insertBefore(item, from.children[oldIndex] ?? null);

		const list = [...blocks];
		const [moved] = list.splice(oldIndex, 1);
		list.splice(newIndex, 0, moved!);
		const before = list[newIndex - 1] && lastOrder(list[newIndex - 1]!);
		const after = list[newIndex + 1] && firstOrder(list[newIndex + 1]!);
		if (moved!.type === 'section') {
			await editor.reorder([
				{
					ref: { type: 'SongSection', _id: moved!.section._id },
					order: orderBetween(before, after)
				}
			]);
		} else {
			const orders = ordersBetween(before, after, moved!.lines.length);
			await editor.reorder(
				moved!.lines.map((line, index) => ({
					ref: { type: 'SongLine', _id: line._id },
					order: orders[index]!
				}))
			);
		}
	}

	/* ---------- Line selection → groups and blocks ---------- */

	const selected = $derived.by(() => {
		const selection = editor.selection;
		const block = selection && blocks.find((b) => b.key === selection.blockKey);
		if (!selection || !block) return undefined;
		const from = Math.min(selection.anchor, selection.focus);
		const to = Math.max(selection.anchor, selection.focus);
		return {
			dragging: selection.dragging,
			lines: block.lines.slice(from, to + 1),
			/** The line after the selection in the same block: it starts the next group. */
			after: block.lines[to + 1]
		};
	});

	async function group() {
		if (!selected) return;
		const [first, ...rest] = selected.lines;
		await editor.setGroupMarks([
			{ lineId: first!._id, startsGroup: true },
			...rest
				.filter((line) => line.startsGroup)
				.map((line) => ({ lineId: line._id, startsGroup: false })),
			...(selected.after ? [{ lineId: selected.after._id, startsGroup: true }] : [])
		]);
		editor.selection = null;
	}

	async function ungroup() {
		if (!selected) return;
		await editor.setGroupMarks(
			[...selected.lines, ...(selected.after ? [selected.after] : [])]
				.filter((line) => line.startsGroup)
				.map((line) => ({ lineId: line._id, startsGroup: false }))
		);
		editor.selection = null;
	}

	async function makeBlock() {
		if (!selected) return;
		const id = await editor.createSection(
			'New block',
			'lyrics',
			selected.lines.map((line) => line._id)
		);
		editor.selection = null;
		editor.renaming = id;
	}

	async function addSection(kindTag: 'lyrics' | 'interlude') {
		const id = await editor.createSection(
			kindTag === 'interlude' ? 'Instrumental' : 'New block',
			kindTag
		);
		editor.renaming = id;
	}

	async function addLooseLine() {
		const id = await editor.addLine({ type: 'Song', _id: arrangement.song._id as Id<'Song'> });
		await editor.focusLine(id, 0);
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (!(event.target as Element).closest?.('[data-selection-keep]')) editor.selection = null;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') editor.selection = null;
	}}
/>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div
			class="inline-flex rounded-2xl bg-card p-1 shadow-sm"
			role="radiogroup"
			aria-label="How to enter chords"
		>
			{#each modes as mode (mode.value)}
				<label
					class={cn(
						'cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
						editor.mode.current === mode.value
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'
					)}
					title={mode.hint}
				>
					<input
						type="radio"
						class="sr-only"
						name="chord-entry-mode"
						value={mode.value}
						checked={editor.mode.current === mode.value}
						onchange={() => (editor.mode.current = mode.value)}
					/>
					{mode.label}
				</label>
			{/each}
		</div>
		<p class="text-xs text-muted-foreground">
			Drag along a line’s left edge to select lines{#if editor.mode.current === 'picker'}; tap above
				a letter for a chord{/if}.
		</p>
	</div>

	<div
		class="flex flex-col gap-3"
		{@attach sortable({ handle: '.block-handle', onUpdate: onReorder })}
	>
		{#each blocks as block, blockIndex (block.key)}
			<div data-id={block.key} animate:flip={{ duration: 220 }} transition:fade={{ duration: 150 }}>
				<BlockEditor
					{block}
					groups={groups.filter((group) => group.blockIndex === blockIndex)}
					repeatCount={block.type === 'section' && !block.isRepeat
						? blocks.filter(
								(b) => b.type === 'section' && b.isRepeat && b.source._id === block.section._id
							).length
						: 0}
				/>
			</div>
		{/each}
	</div>

	{#if !blocks.length}
		<p class="py-6 text-center text-muted-foreground">
			Start with a block for the first verse, or add loose lines.
		</p>
	{/if}

	<div class="flex flex-wrap justify-center gap-2 pt-2">
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent"
			onclick={() => addSection('lyrics')}
		>
			<SquarePlus class="size-4" /> Add block
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-primary/35 px-4 py-2 text-sm font-medium hover:bg-primary/10"
			onclick={() => addSection('interlude')}
		>
			<Music class="size-4" /> Add interlude
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
			onclick={addLooseLine}
		>
			<Plus class="size-4" /> Add loose line
		</button>
	</div>
</div>

{#if selected && !selected.dragging}
	<div
		class="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3"
		transition:fly={{ y: 24, duration: 180 }}
	>
		<div
			class="flex items-center gap-1 rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-2xl ring-1 ring-border"
			data-selection-keep
			role="toolbar"
			aria-label="Selected lines"
		>
			<span class="px-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
				{selected.lines.length}
				{selected.lines.length === 1 ? 'line' : 'lines'}
			</span>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
				onclick={group}
			>
				<Group class="size-4" /> Group
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
				onclick={ungroup}
			>
				<Ungroup class="size-4" /> Ungroup
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
				onclick={makeBlock}
			>
				<SquarePlus class="size-4" /> <span class="max-sm:hidden">Make block</span><span
					class="sm:hidden">Block</span
				>
			</button>
			<button
				type="button"
				class="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label="Clear selection"
				onclick={() => (editor.selection = null)}
			>
				<X class="size-4" />
			</button>
		</div>
	</div>
{/if}

<ChordPicker />
