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
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
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
	import {
		SongEditorState,
		setSongEditor,
		type ChordEntryMode,
		type LineDrop
	} from './editor.svelte.js';

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
	/**
	 * Each block's identity on screen: a loose run by its place among loose runs, not by its first line, so a
	 * line moved to or from the top of a run doesn't swap the whole run out.
	 */
	const blockKeys = $derived.by(() => {
		let loose = 0;
		return blocks.map((block) => (block.type === 'loose' ? `loose:${loose++}` : block.key));
	});

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

	/* ---------- Move a line by its handle: within a block, to another, to or from loose lines ---------- */

	async function moveLine(lineId: Id<'SongLine'>, target: ArrangementBlock, drop: LineDrop) {
		const from = blocks.find(
			(b) => !(b.type === 'section' && b.isRepeat) && b.lines.some((l) => l._id === lineId)
		);
		if (!from) return;
		const index = from.lines.findIndex((l) => l._id === lineId);
		const line = from.lines[index]!;
		const next = from.lines[index + 1];
		const above = target.lines.find((l) => l._id === drop.aboveId);
		const below = target.lines.find((l) => l._id === drop.belowId);

		const marks = new Map<Id<'SongLine'>, boolean>();
		// The group it leaves carries on without it: the line after it starts the group in its place.
		if (line.startsGroup && next && !next.startsGroup) marks.set(next._id, true);
		// Dropped at the top of a group it starts that group; anywhere else it joins the group it's in.
		marks.set(line._id, drop.atGroupTop);
		if (drop.atGroupTop && below) marks.set(below._id, false);

		// Loose lines share the song's order space with blocks, so a run's ends border the blocks around it.
		const at = blocks.findIndex((b) => b.key === target.key);
		const isLoose = target.type === 'loose';
		const order = orderBetween(
			above?.order ?? (isLoose && blocks[at - 1] ? lastOrder(blocks[at - 1]!) : undefined),
			below?.order ?? (isLoose && blocks[at + 1] ? firstOrder(blocks[at + 1]!) : undefined)
		);
		await editor.moveLine(
			{
				lineId,
				parentRef: editor.parentRefOf(target),
				aboveId: drop.aboveId,
				belowId: drop.belowId,
				marks: [...marks].map(([id, startsGroup]) => ({ lineId: id, startsGroup }))
			},
			order
		);
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
			/** Whether a line in the same block comes before the selection. */
			hasBefore: from > 0,
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

	/**
	 * Merges the selection into one neighbouring group: the one before it, or at the top of a block the one
	 * after it. Ungrouping [C D] in [A B][C D][E F] gives [A B C D][E F].
	 */
	async function ungroup() {
		if (!selected) return;
		const after = !selected.hasBefore && selected.after ? [selected.after] : [];
		await editor.setGroupMarks(
			[...selected.lines, ...after]
				.filter((line) => line.startsGroup)
				.map((line) => ({ lineId: line._id, startsGroup: false }))
		);
		editor.selection = null;
	}

	async function makeBlock() {
		if (!selected) return;
		try {
			const id = await editor.createSection(
				'New block',
				'lyrics',
				selected.lines.map((line) => line._id)
			);
			editor.selection = null;
			editor.renaming = id;
		} catch (error) {
			toast.error(
				error instanceof ConvexError ? String(error.data) : 'Couldn’t make the block. Try again.'
			);
		}
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
		{#each blocks as block, blockIndex (blockKeys[blockIndex])}
			<div data-id={block.key} animate:flip={{ duration: 220 }} transition:fade={{ duration: 150 }}>
				<BlockEditor
					{block}
					onMoveLine={(lineId, drop) => moveLine(lineId, block, drop)}
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
