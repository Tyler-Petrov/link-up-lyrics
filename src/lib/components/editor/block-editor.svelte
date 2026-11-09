<script lang="ts">
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Music from '@lucide/svelte/icons/music';
	import Plus from '@lucide/svelte/icons/plus';
	import Repeat from '@lucide/svelte/icons/repeat-2';
	import Trash from '@lucide/svelte/icons/trash-2';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import type { SortableEvent } from 'sortablejs';
	import type { Id } from '#convex/_generated/dataModel.js';
	import type { ArrangementBlock, ChartGroup } from '#lib/chart/index.js';
	import { confirmation } from '#lib/confirmation.svelte.js';
	import ChartLine from '#lib/components/chart/chart-line.svelte';
	import { sortable } from '#lib/sortable.js';
	import { cn } from '#lib/utils.js';
	import { getSongEditor, type LineDrop } from './editor.svelte.js';
	import LineEditor from './line-editor.svelte';

	type Props = {
		block: ArrangementBlock;
		/** This block's line groups, from groupArrangement over the whole song. */
		groups: ChartGroup[];
		/** How many repeats play this block again (they go when it's deleted). */
		repeatCount: number;
		/** A line was dragged by its handle into this block (from it, or from another). */
		onMoveLine: (lineId: Id<'SongLine'>, drop: LineDrop) => Promise<void>;
	};
	let { block, groups, repeatCount, onMoveLine }: Props = $props();

	const editor = getSongEditor();
	const section = $derived(block.type === 'section' ? block.section : undefined);
	const isRepeat = $derived(block.type === 'section' && block.isRepeat);
	const isInterlude = $derived(block.type === 'section' && block.source.kindTag === 'interlude');
	const lineIndex = $derived(new Map(block.lines.map((line, index) => [line._id, index])));

	const selection = $derived(editor.selection?.blockKey === block.key ? editor.selection : null);
	const isSelected = (index: number) =>
		!!selection &&
		index >= Math.min(selection.anchor, selection.focus) &&
		index <= Math.max(selection.anchor, selection.focus);

	/* ---------- Drag across the rail to select lines (mouse), or long-press then drag (touch) ---------- */

	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart = { x: 0, y: 0 };

	function lineAt(x: number, y: number) {
		const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-select-line]');
		if (row?.dataset.blockKey !== block.key) return undefined;
		return Number(row.dataset.selectLine);
	}

	function startSelecting(index: number) {
		editor.selection = { blockKey: block.key, anchor: index, focus: index, dragging: true };
	}

	function onRailPointerDown(event: PointerEvent, index: number) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		if (event.pointerType === 'mouse') {
			event.preventDefault();
			startSelecting(index);
			return;
		}
		pressStart = { x: event.clientX, y: event.clientY };
		clearTimeout(pressTimer);
		pressTimer = setTimeout(() => {
			navigator.vibrate?.(10);
			startSelecting(index);
		}, 350);
	}

	function onRailPointerMove(event: PointerEvent) {
		if (pressTimer && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10)
			clearTimeout(pressTimer);
		if (!selection?.dragging) return;
		const index = lineAt(event.clientX, event.clientY);
		if (index !== undefined) selection.focus = index;
	}

	function onRailPointerUp() {
		clearTimeout(pressTimer);
		pressTimer = undefined;
		if (selection) selection.dragging = false;
	}

	/* ---------- Move lines by their handles: every group's list shares one Sortable group ---------- */

	const lineSortable = sortable({
		group: 'song-lines',
		handle: '.line-handle',
		draggable: '[data-line-id]',
		onUpdate: onLineDrop
	});

	function onLineDrop({ item, from, to, oldIndex }: SortableEvent) {
		const rows = [...to.closest('section')!.querySelectorAll<HTMLElement>('[data-line-id]')];
		const at = rows.indexOf(item);
		const idOf = (row: HTMLElement | undefined) =>
			row?.dataset.lineId as Id<'SongLine'> | undefined;
		const drop: LineDrop = {
			aboveId: idOf(rows[at - 1]),
			belowId: idOf(rows[at + 1]),
			atGroupTop: to.querySelector('[data-line-id]') === item
		};
		// Svelte owns the rows: put this one back where it was, and the (optimistic) data moves it.
		item.remove();
		from.insertBefore(item, from.children[oldIndex!] ?? null);
		return onMoveLine(idOf(item)!, drop);
	}

	/* ---------- Block actions ---------- */

	function renameAttachment(input: HTMLInputElement) {
		input.focus();
		input.select();
	}

	function rename(input: HTMLInputElement) {
		if (editor.renaming !== section?._id) return;
		editor.renaming = null;
		const name = input.value.trim();
		if (section && name && name !== section.name) void editor.renameSection(section._id, name);
	}

	async function remove() {
		if (!section) return;
		const confirmed = await confirmation({
			title: isInterlude ? 'Delete interlude' : 'Delete block',
			message: isRepeat
				? `This repeat of “${section.name}” will be removed. The original stays.`
				: `“${section.name}” and its lines will be deleted.` +
					(repeatCount
						? ` Its ${repeatCount === 1 ? 'repeat goes' : `${repeatCount} repeats go`} too.`
						: ''),
			confirmLabel: 'Delete'
		});
		if (confirmed) await editor.removeSection(section._id);
	}

	async function addLine() {
		const id = await editor.addLine(editor.parentRefOf(block), block.lines.at(-1)?.order);
		await editor.focusLine(id, 0);
	}
</script>

<section
	id={section ? `block-${section._id}` : undefined}
	class={cn(
		'flex flex-col gap-2 rounded-3xl p-2 transition-[box-shadow,background-color] duration-500 sm:p-3',
		isInterlude
			? 'border-2 border-dashed border-primary/35 bg-primary/[0.04]'
			: block.type === 'loose'
				? 'bg-transparent'
				: isRepeat
					? 'bg-card/35'
					: 'bg-card/70',
		editor.highlighted === section?._id && 'bg-primary/15 ring-2 ring-primary'
	)}
>
	<header class="flex min-h-10 items-center gap-1">
		<button
			type="button"
			class="block-handle cursor-grab touch-none rounded-lg p-1.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
			aria-label="Drag to reorder"
		>
			<GripVertical class="size-4" />
		</button>
		{#if section}
			{#if isInterlude}
				<Music class="size-4 shrink-0 text-primary" />
			{:else if isRepeat}
				<Repeat class="size-4 shrink-0 text-muted-foreground" />
			{/if}
			{#if editor.renaming === section._id}
				<input
					{@attach renameAttachment}
					value={section.name}
					class="min-w-0 flex-1 rounded-lg bg-foreground/5 px-2 py-1 text-sm font-semibold tracking-wide uppercase outline-none focus:ring-2 focus:ring-ring"
					aria-label="Block name"
					maxlength="100"
					onblur={(event) => rename(event.currentTarget)}
					onkeydown={(event) => {
						if (event.key === 'Enter') rename(event.currentTarget);
						if (event.key === 'Escape') editor.renaming = null;
					}}
				/>
			{:else}
				<button
					type="button"
					class="min-w-0 truncate rounded-lg px-2 py-1 text-left text-sm font-semibold tracking-wide text-muted-foreground uppercase hover:bg-accent hover:text-foreground"
					title="Rename"
					onclick={() => (editor.renaming = section._id)}
				>
					{section.name}
				</button>
			{/if}
			{#if isRepeat && block.type === 'section'}
				<button
					type="button"
					class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium hover:bg-primary hover:text-primary-foreground"
					onclick={() => editor.reveal(block.source._id)}
				>
					<CornerUpLeft class="size-3" /> Edit original
				</button>
			{/if}
			<div class="ml-auto flex shrink-0 items-center">
				<button
					type="button"
					class="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
					title="Repeat this block at the end of the song"
					aria-label="Repeat {section.name}"
					onclick={() => editor.repeatSection(section._id)}
				>
					<Repeat class="size-4" />
				</button>
				<button
					type="button"
					class="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					aria-label="Delete {section.name}"
					onclick={remove}
				>
					<Trash class="size-4" />
				</button>
			</div>
		{:else}
			<span class="px-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase"
				>Lines</span
			>
		{/if}
	</header>

	<div class="flex flex-col gap-1">
		{#each groups as group (group.key)}
			{@const tinted = group.index % 2 === 0}
			<div
				class={cn('relative rounded-2xl', tinted ? 'bg-primary/[0.07]' : 'bg-transparent')}
				animate:flip={{ duration: 200 }}
				{@attach !isRepeat && lineSortable}
			>
				<span
					class={cn(
						'pointer-events-none absolute top-1.5 left-1 flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold tabular-nums',
						tinted ? 'bg-primary text-primary-foreground' : 'bg-primary/30 text-foreground'
					)}
					title="Line group {group.index + 1}: what the leader advances to live"
					>{group.index + 1}</span
				>
				<div
					class={cn(
						'pointer-events-none absolute top-8 bottom-2 left-[0.8rem] w-1 rounded-full',
						tinted ? 'bg-primary/70' : 'bg-primary/30'
					)}
				></div>
				{#if !group.lines.length}
					<p class="flex min-h-9 items-center gap-2 pr-3 pl-9 text-sm text-muted-foreground italic">
						{#if isInterlude}
							<AudioLines class="size-4" /> Music only. Singers see a card; add a chord line for players.
						{:else}
							No lines yet.
						{/if}
					</p>
				{/if}
				{#each group.lines as line (line._id)}
					{@const index = lineIndex.get(line._id)!}
					<div
						class={cn(
							'flex min-h-9 items-stretch rounded-xl transition-colors',
							isSelected(index) && 'bg-primary/25'
						)}
						data-select-line={index}
						data-block-key={block.key}
						data-line-id={isRepeat ? undefined : line._id}
						transition:slide={{ duration: 160 }}
					>
						<!-- The rail: drag along it to select lines (long-press first on touch). -->
						<div
							class={cn(
								'w-8 shrink-0 touch-none rounded-l-xl select-none',
								isRepeat ? '' : 'cursor-row-resize hover:bg-primary/10'
							)}
							role="presentation"
							data-selection-keep
							oncontextmenu={(event) => event.preventDefault()}
							onpointerdown={isRepeat ? undefined : (event) => onRailPointerDown(event, index)}
							onpointermove={onRailPointerMove}
							onpointerup={onRailPointerUp}
							onpointercancel={onRailPointerUp}
						></div>
						{#if isRepeat}
							<ChartLine characters={line.characters} class="py-1 opacity-80" />
						{:else}
							<LineEditor {line} previous={block.lines[index - 1]} chordsOnly={isInterlude} />
							<button
								type="button"
								class="line-handle mb-0.5 shrink-0 cursor-grab touch-none self-end rounded-lg p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
								aria-label="Drag to move this line"
								title="Drag to move this line"
							>
								<GripVertical class="size-4" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	{#if !isRepeat}
		<button
			type="button"
			class="ml-8 inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
			onclick={addLine}
		>
			<Plus class="size-4" />
			{isInterlude ? 'Add chord line' : 'Add line'}
		</button>
	{/if}
</section>
