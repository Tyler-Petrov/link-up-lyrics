/*
 * The song editor's shared state, provided by song-editor.svelte to its blocks and lines: the mutations
 * (optimistic where it's cheap, so chords and group marks land instantly), the chord-entry mode, the line
 * selection that groups and makes blocks, and the chord picker's target.
 */
import { createContext, tick } from 'svelte';
import { useConvexClient } from 'convex-svelte';
import type { OptimisticLocalStore } from 'convex/browser';
import { PersistedState } from 'runed';
import { api } from '#convex/_generated/api.js';
import type { Doc, Id } from '#convex/_generated/dataModel.js';
import type { ChartCharacter, Chord } from '#convex/validators.js';
import { buildArrangement, type ArrangementBlock } from '#lib/chart/index.js';

export type ChordEntryMode = 'picker' | 'brackets';

/** A line to focus once it renders, with the caret at `caret` (in the input's own units). */
type FocusRequest = { lineId: string; caret: number };

export type LineSelection = {
	blockKey: string;
	/** Indices into the block's lines; `anchor` is where the drag started. */
	anchor: number;
	focus: number;
	dragging: boolean;
};

export type PickerTarget = {
	characters: ChartCharacter[];
	index: number;
	onPick: (chord: Chord | undefined) => void;
};

type Line = Doc<'SongLine'>;

export class SongEditorState {
	#client = useConvexClient();
	/** The URL's song id, which is also getArrangement's argument: optimistic updates patch that query. */
	readonly routeSongId: string;
	readonly songId: Id<'Song'>;

	/** Picker on touch screens, brackets with a keyboard; a per-device preference. Plan §10.1. */
	mode = new PersistedState<ChordEntryMode>(
		'chord-entry-mode',
		typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
			? 'picker'
			: 'brackets'
	);
	selection = $state<LineSelection | null>(null);
	picker = $state<PickerTarget | null>(null);
	focusRequest = $state<FocusRequest | null>(null);
	/** The block being renamed, by section id. */
	renaming = $state<string | null>(null);
	/** A block flashed after "edit original". */
	highlighted = $state<string | null>(null);

	constructor(routeSongId: string, songId: Id<'Song'>) {
		this.routeSongId = routeSongId;
		this.songId = songId;
	}

	/* ---------- Optimistic updates on song.getArrangement ---------- */

	#patchBlocks(
		store: OptimisticLocalStore,
		update: (blocks: ArrangementBlock[]) => ArrangementBlock[]
	) {
		const args = { songId: this.routeSongId };
		const current = store.getQuery(api.song.getArrangement, args);
		if (current)
			store.setQuery(api.song.getArrangement, args, { ...current, blocks: update(current.blocks) });
	}

	#patchLines(store: OptimisticLocalStore, patch: (line: Line) => Line) {
		this.#patchBlocks(store, (blocks) =>
			blocks.map((block) => ({ ...block, lines: block.lines.map(patch) }))
		);
	}

	/* ---------- Lines ---------- */

	setCharacters(lineId: Id<'SongLine'>, characters: ChartCharacter[]) {
		return this.#client.mutation(
			api.song_edit.setCharacters,
			{ lineId, characters },
			{
				optimisticUpdate: (store) =>
					this.#patchLines(store, (line) => (line._id === lineId ? { ...line, characters } : line))
			}
		);
	}

	replaceLine(lineId: Id<'SongLine'>, lines: ChartCharacter[][]) {
		return this.#client.mutation(
			api.song_edit.replaceLine,
			{ lineId, lines },
			{
				optimisticUpdate: (store) =>
					this.#patchLines(store, (line) =>
						line._id === lineId ? { ...line, characters: lines[0]! } : line
					)
			}
		);
	}

	addLine(parentRef: Line['parentRef'], afterOrder?: number) {
		return this.#client.mutation(api.song_edit.addLine, { parentRef, afterOrder });
	}

	/** `joined` is the line above with this one appended, shown while it saves. */
	mergeLineUp(lineId: Id<'SongLine'>, previousId: Id<'SongLine'>, joined: ChartCharacter[]) {
		return this.#client.mutation(
			api.song_edit.mergeLineUp,
			{ lineId },
			{
				optimisticUpdate: (store) =>
					this.#patchBlocks(store, (blocks) =>
						blocks.map((block) => ({
							...block,
							lines: block.lines
								.filter((line) => line._id !== lineId)
								.map((line) => (line._id === previousId ? { ...line, characters: joined } : line))
						}))
					)
			}
		);
	}

	removeLine(lineId: Id<'SongLine'>) {
		return this.#client.mutation(
			api.song_edit.removeLine,
			{ lineId },
			{
				optimisticUpdate: (store) =>
					this.#patchBlocks(store, (blocks) =>
						blocks
							.map((block) => ({ ...block, lines: block.lines.filter((l) => l._id !== lineId) }))
							.filter((block) => block.type === 'section' || block.lines.length)
					)
			}
		);
	}

	setGroupMarks(marks: { lineId: Id<'SongLine'>; startsGroup: boolean }[]) {
		const byId = new Map(marks.map((mark) => [mark.lineId as string, mark.startsGroup]));
		return this.#client.mutation(
			api.song_edit.setGroupMarks,
			{ marks },
			{
				optimisticUpdate: (store) =>
					this.#patchLines(store, (line) =>
						byId.has(line._id) ? { ...line, startsGroup: byId.get(line._id) || undefined } : line
					)
			}
		);
	}

	/** Focuses a line after it renders (a new line from Enter, the line above after a merge). */
	async focusLine(lineId: string, caret: number) {
		this.focusRequest = { lineId, caret };
		await tick();
	}

	/* ---------- Blocks ---------- */

	createSection(name: string, kindTag: Doc<'SongSection'>['kindTag'], lineIds?: Id<'SongLine'>[]) {
		return this.#client.mutation(api.song_edit.createSection, {
			songId: this.songId,
			name,
			kindTag,
			lineIds
		});
	}

	renameSection(sectionId: Id<'SongSection'>, name: string) {
		return this.#client.mutation(
			api.song_edit.renameSection,
			{ sectionId, name },
			{
				optimisticUpdate: (store) =>
					this.#patchBlocks(store, (blocks) =>
						blocks.map((block) =>
							block.type === 'section' && block.section._id === sectionId
								? { ...block, section: { ...block.section, name } }
								: block
						)
					)
			}
		);
	}

	removeSection(sectionId: Id<'SongSection'>) {
		return this.#client.mutation(
			api.song_edit.removeSection,
			{ sectionId },
			{
				optimisticUpdate: (store) =>
					this.#patchBlocks(store, (blocks) =>
						blocks.filter(
							(block) =>
								block.type !== 'section' ||
								(block.section._id !== sectionId && block.source._id !== sectionId)
						)
					)
			}
		);
	}

	repeatSection(sectionId: Id<'SongSection'>) {
		return this.#client.mutation(api.song_edit.repeatSection, { sectionId });
	}

	/** Moves blocks and loose lines to new orders, re-merging the arrangement locally while it saves. */
	reorder(
		items: {
			ref:
				{ type: 'SongSection'; _id: Id<'SongSection'> } | { type: 'SongLine'; _id: Id<'SongLine'> };
			order: number;
		}[]
	) {
		const orders = new Map(items.map((item) => [item.ref._id as string, item.order]));
		return this.#client.mutation(
			api.song_edit.reorder,
			{ songId: this.songId, items },
			{
				optimisticUpdate: (store) =>
					this.#patchBlocks(store, (blocks) => {
						const reorder = <T extends { _id: string; order: number }>(row: T) =>
							orders.has(row._id) ? { ...row, order: orders.get(row._id)! } : row;
						const sections = blocks.flatMap((b) =>
							b.type === 'section' ? [reorder(b.section)] : []
						);
						const looseLines = blocks.flatMap((b) =>
							b.type === 'loose' ? b.lines.map(reorder) : []
						);
						const linesBySection = new Map(
							blocks.flatMap((b) =>
								b.type === 'section' && !b.isRepeat ? [[b.section._id, b.lines] as const] : []
							)
						);
						return buildArrangement(sections, looseLines, linesBySection);
					})
			}
		);
	}

	/** Scrolls to a block and flashes it ("edit the original" on a repeat). */
	async reveal(sectionId: string) {
		document
			.getElementById(`block-${sectionId}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		this.highlighted = sectionId;
		setTimeout(() => {
			if (this.highlighted === sectionId) this.highlighted = null;
		}, 1800);
	}
}

export const [getSongEditor, setSongEditor] = createContext<SongEditorState>();
