<script lang="ts">
	import { tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Group from '@lucide/svelte/icons/group';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Ungroup from '@lucide/svelte/icons/ungroup';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import Music from '@lucide/svelte/icons/music';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import type { SortableEvent } from 'sortablejs';
	import type { Doc, Id } from '#convex/_generated/dataModel.js';
	import type { SongArrangement } from '#convex/model/song.js';
	import {
		groupArrangement,
		orderBetween,
		ordersBetween,
		type ArrangementBlock
	} from '#lib/chart/index.js';
	import { useConnection } from '#lib/connection.svelte.js';
	import { appear, morph, ms, reduced, reveal } from '#lib/motion.js';
	import { sortable } from '#lib/sortable.js';
	import { cn } from '#lib/utils.js';
	import { Advanced } from '#lib/components/ui/advanced/index.js';
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

	/** `default`: before the mode is known (line-editor), shown picked on the screens it's the default for. */
	const modes: { value: ChordEntryMode; label: string; hint: string; default: string }[] = [
		{
			value: 'picker',
			label: 'Tap chords',
			hint: 'Tap above a letter to pick a chord',
			default: 'pointer-coarse:bg-primary pointer-coarse:text-primary-foreground'
		},
		{
			value: 'brackets',
			label: 'Brackets',
			hint: 'Type chords in brackets: [G]Amazing [G7]grace',
			default: 'pointer-fine:bg-primary pointer-fine:text-primary-foreground'
		}
	];

	/* ---------- Reorder: blocks and loose-line runs share the song's order space ---------- */

	const firstOrder = (block: ArrangementBlock) =>
		block.type === 'section' ? block.section.order : block.lines[0]!.order;
	const lastOrder = (block: ArrangementBlock) =>
		block.type === 'section' ? block.section.order : block.lines.at(-1)!.order;

	async function onReorder(event: SortableEvent) {
		const { oldIndex, newIndex } = event;
		if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;

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

	/** The selected lines, and the group marks each toolbar action would change (none: it'd do nothing). */
	const selected = $derived.by(() => {
		const selection = editor.selection;
		const block = selection && blocks.find((b) => b.key === selection.blockKey);
		if (!selection || !block) return undefined;
		const from = Math.min(selection.anchor, selection.focus);
		const to = Math.max(selection.anchor, selection.focus);
		const lines = block.lines.slice(from, to + 1);
		const [first, ...rest] = lines;
		/** The line after the selection in the same block: it starts the next group. */
		const after = block.lines[to + 1];
		const mark = (startsGroup: boolean) => (line: Doc<'SongLine'>) => ({
			lineId: line._id,
			startsGroup
		});
		const groupMarks = [
			...(from > 0 && !first!.startsGroup ? [mark(true)(first!)] : []),
			...rest.filter((line) => line.startsGroup).map(mark(false)),
			...(after && !after.startsGroup ? [mark(true)(after)] : [])
		];
		/**
		 * Merged into one neighbouring group: the one above, or at the top of a block the one below.
		 * Ungrouping [C D] in [A B][C D][E F] gives [A B C D][E F]. A block's first line always starts one.
		 */
		const ungroupMarks = [...(from > 0 ? lines : rest), ...(from === 0 && after ? [after] : [])]
			.filter((line) => line.startsGroup)
			.map(mark(false));
		const groupStarts = rest.filter((line) => line.startsGroup).length;
		/** Every line of a block: moving them all to a new block would only leave this one empty behind. */
		const wholeBlock = block.type === 'section' && from === 0 && !after;
		const groupCount = groupStarts ? `${groupStarts + 1} groups` : 'one group';
		return {
			dragging: selection.dragging,
			lines,
			/**
			 * Says why Group, Ungroup or Block is greyed out, on touch screens too (no tooltips there). The whole
			 * block always says so, as Block is greyed out then; a loose run all selected has nothing to merge into.
			 */
			groupsLabel: wholeBlock
				? `the whole block, ${groupCount}`
				: groupMarks.length && !groupStarts
					? 'part of a group'
					: groupMarks.length || ungroupMarks.length
						? groupCount
						: 'the block’s only group',
			wholeBlock,
			/** One group: its first line starts one, the line after it starts the next, none between. */
			groupMarks,
			ungroupMarks,
			atBlockTop: from === 0
		};
	});

	async function setMarks(marks: { lineId: Id<'SongLine'>; startsGroup: boolean }[]) {
		editor.selection = null;
		await editor.setGroupMarks(marks);
	}

	async function makeBlock() {
		if (!selected) return;
		const id = await editor.createSection(
			'New block',
			'lyrics',
			selected.lines.map((line) => line._id)
		);
		if (!id) return;
		editor.selection = null;
		editor.renaming = id;
	}

	async function addSection(kindTag: 'lyrics' | 'interlude') {
		const id = await editor.createSection(
			kindTag === 'interlude' ? 'Instrumental' : 'New block',
			kindTag
		);
		if (id) editor.renaming = id;
	}

	async function addLooseLine() {
		const id = await editor.addLine({ type: 'Song', _id: arrangement.song._id as Id<'Song'> });
		if (id) editor.focusLine(id, 0);
	}

	const connection = useConnection();
	const statuses = {
		saving: { icon: LoaderCircle, label: 'Saving…', class: 'animate-spin' },
		/* Convex holds the changes and sends them once it reconnects. */
		waiting: { icon: WifiOff, label: 'Waiting to save', class: '' },
		saved: { icon: Check, label: 'Saved', class: '' },
		failed: { icon: CircleAlert, label: 'Not saved', class: 'text-destructive' }
	};
	const status = $derived(
		statuses[editor.status === 'saving' && connection.reconnecting ? 'waiting' : editor.status]
	);

	/**
	 * The toolbar covers the bottom of the screen, where a drag down a phone usually ends, so once it shows the
	 * last selected line scrolls up above it (rows keep a bottom scroll margin of the toolbar's height).
	 */
	function keepSelectionInView() {
		const selection = editor.selection;
		if (!selection) return;
		const last = Math.max(selection.anchor, selection.focus);
		document
			.querySelector(
				`[data-block-key="${CSS.escape(selection.blockKey)}"][data-select-line="${last}"]`
			)
			?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
	}

	/** The bar with the mode switch and save status, which stays under the app header. */
	let bar = $state<HTMLElement>();

	/**
	 * A mode change adds or takes away a chord lane above every line, which would slide the song past whoever is
	 * reading it. The line in the middle of the screen (or the last, when the song ends above it) holds still
	 * instead, inside the crossfade.
	 */
	async function setMode(mode: ChordEntryMode) {
		const middle = (bar!.getBoundingClientRect().bottom + innerHeight) / 2;
		const rows = [...document.querySelectorAll('[data-select-line]')];
		const row = rows.find((row) => row.getBoundingClientRect().bottom >= middle) ?? rows.at(-1);
		const top = row?.getBoundingClientRect().top ?? 0;
		editor.setMode(mode);
		await tick();
		if (row) scrollBy({ top: row.getBoundingClientRect().top - top, behavior: 'instant' });
	}

	const toolbarButton =
		'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-opacity enabled:hover:bg-accent disabled:opacity-40 pointer-coarse:min-h-10';
</script>

<svelte:window
	onpointerdown={(event) => {
		if (!(event.target as Element).closest?.('[data-selection-keep]')) editor.selection = null;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') editor.selection = null;
	}}
	onbeforeunload={(event) => {
		// A reload or close would drop changes not yet saved (typing waits for a pause; offline, everything waits).
		if (editor.status === 'saving') event.preventDefault();
	}}
/>

<div class="flex flex-col gap-4">
	<!-- Stays under the app header while you scroll, so whether your words are saved is always in view. -->
	<div
		bind:this={bar}
		class="sticky-under-header z-30 -mx-2 flex items-center justify-between gap-3 rounded-2xl bg-background/85 p-2 backdrop-blur-md"
	>
		<div
			class="inline-flex rounded-2xl bg-card p-1 shadow-sm"
			role="radiogroup"
			aria-label="How to enter chords"
		>
			{#each modes as mode (mode.value)}
				<label
					class={cn(
						'cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
						editor.mode === mode.value
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground',
						!editor.mode && mode.default
					)}
					title={mode.hint}
				>
					<input
						type="radio"
						class="sr-only"
						name="chord-entry-mode"
						value={mode.value}
						checked={editor.mode === mode.value}
						onchange={() => morph(() => setMode(mode.value))}
					/>
					{mode.label}
				</label>
			{/each}
		</div>
		<!-- A fixed width, so the words changing never moves anything. The old words fade out before the new
		     ones fade in, so the two never overlap. -->
		<p role="status" class="grid w-32 shrink-0 justify-items-end text-sm text-muted-foreground">
			{#key status}
				<span
					class="col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap"
					in:fade={{ delay: ms(150), duration: ms(150) }}
					out:appear
				>
					<status.icon class={cn('size-4', status.class)} />
					{status.label}
				</span>
			{/key}
		</p>
	</div>

	<p class="-mt-2 px-1 text-xs text-muted-foreground">
		<span class="pointer-coarse:hidden">Drag down a line’s left edge to select lines.</span>
		<span class="pointer-fine:hidden"
			>Press and hold a line’s left edge, then drag to select lines.</span
		>
		<!-- Before the mode is known, as for the default mode on this kind of screen. -->
		<span class={[editor.mode ? editor.mode !== 'picker' && 'hidden' : 'pointer-fine:hidden']}
			>Tap above a letter for a chord.</span
		>
		The numbers are the steps a leader moves through live.
	</p>

	<!-- Padding rather than a gap between blocks, so the space opens and closes with each block. No flip:
	     its moves would pull a closing block out of the flow, and a drop already shows where the block went. -->
	<div
		class="-mt-3 flex flex-col"
		{@attach sortable({ handle: '.block-handle', onUpdate: onReorder })}
	>
		{#each blocks as block, blockIndex (blockKeys[blockIndex])}
			<div data-id={block.key} class="pt-3" transition:reveal>
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

	<div class="flex flex-col items-center pt-2">
		{#if !blocks.length}
			<p class="pb-6 text-center text-muted-foreground" transition:reveal>
				Start with a block for the first verse.
			</p>
		{/if}
		<div class="flex flex-wrap justify-center gap-2">
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
		</div>
		<Advanced class="mt-3 justify-items-center">
			<div class="flex flex-col items-center gap-2 text-center">
				<p class="max-w-sm text-xs text-muted-foreground">
					Loose lines sit between blocks with no heading of their own.
				</p>
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
					onclick={addLooseLine}
				>
					<Plus class="size-4" /> Add loose line
				</button>
			</div>
		</Advanced>
	</div>
</div>

{#if selected && !selected.dragging}
	<div
		class="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3"
		transition:fly={{ y: 24, duration: ms(180) }}
		{@attach keepSelectionInView}
	>
		<!-- On a phone the count gets a row of its own above the buttons, so all of it fits. -->
		<div
			class="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-2xl ring-1 ring-border"
			data-selection-keep
			role="toolbar"
			aria-label="Selected lines"
		>
			<span
				class="px-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums max-sm:w-full max-sm:pt-1 max-sm:text-center"
			>
				{selected.lines.length}
				{selected.lines.length === 1 ? 'line' : 'lines'} · {selected.groupsLabel}
			</span>
			<button
				type="button"
				class={toolbarButton}
				disabled={!selected.groupMarks.length}
				title={selected.groupMarks.length
					? 'Make these lines one group: one step when you lead live'
					: 'These lines are already one group'}
				onclick={() => setMarks(selected.groupMarks)}
			>
				<Group class="size-4" /> Group
			</button>
			<button
				type="button"
				class={toolbarButton}
				disabled={!selected.ungroupMarks.length}
				title={!selected.ungroupMarks.length
					? 'No group starts here to merge'
					: selected.atBlockTop
						? 'Merge these lines with the group below them'
						: 'Merge these lines into the group above them'}
				onclick={() => setMarks(selected.ungroupMarks)}
			>
				<Ungroup class="size-4" /> Ungroup
			</button>
			<button
				type="button"
				class={toolbarButton}
				disabled={selected.wholeBlock}
				title={selected.wholeBlock
					? 'These lines are already the whole block: rename it instead'
					: 'Move these lines into a new block of their own'}
				onclick={makeBlock}
			>
				<SquarePlus class="size-4" /> <span class="max-sm:hidden">Make block</span><span
					class="sm:hidden">Block</span
				>
			</button>
			<button
				type="button"
				class="grid place-items-center rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:size-10"
				aria-label="Clear selection"
				onclick={() => (editor.selection = null)}
			>
				<X class="size-4" />
			</button>
		</div>
	</div>
{/if}

<ChordPicker />
