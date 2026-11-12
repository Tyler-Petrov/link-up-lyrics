/*
 * The song editor's shared state, provided by song-editor.svelte to its blocks and lines: the mutations
 * (optimistic where it's cheap, so chords and group marks land instantly) and whether they've saved, the
 * chord-entry mode, the line selection that groups and makes blocks, and the chord picker's target.
 */
import { createContext, tick } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { useConvexClient } from 'convex-svelte';
import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { IsMounted, PersistedState } from 'runed';
import { toast } from 'svelte-sonner';
import { api } from '#convex/_generated/api.js';
import type { Doc, Id } from '#convex/_generated/dataModel.js';
import type { ChartCharacter, Chord } from '#convex/validators.js';
import { buildArrangement, type ArrangementBlock } from '#convex/shared/chart/index.js';
import { errorMessage } from '#lib/errors.js';
import { reduced } from '#lib/motion.js';

export type ChordEntryMode = 'picker' | 'brackets';

/**
 * A line to focus once it renders, with the caret at `caret` (in the input's own units). `characters` are its
 * words after a join, shown straight away: the arrangement can catch up a moment after focus gets there.
 */
type FocusRequest = { lineId: string; caret: number; characters?: ChartCharacter[] };

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
type Section = Doc<'SongSection'>;

/** Where a dragged line was dropped: next to which lines, and whether at the top of a group. */
export type LineDrop = {
	aboveId?: Id<'SongLine'>;
	belowId?: Id<'SongLine'>;
	atGroupTop: boolean;
};

type GroupMark = { lineId: Id<'SongLine'>; startsGroup: boolean };

/** Sets the marked lines' `startsGroup` (left off when false, as the server stores it). */
function withMarks(marks: GroupMark[]) {
	const byId = new Map(marks.map((mark) => [mark.lineId as string, mark.startsGroup]));
	return (line: Line): Line =>
		byId.has(line._id) ? { ...line, startsGroup: byId.get(line._id) || undefined } : line;
}

/**
 * The arrangement rebuilt from its rows after patching some (a new order, a new parent), so they land where
 * the server will put them while it saves.
 */
function rebuild(
	blocks: ArrangementBlock[],
	patchSection: (section: Section) => Section,
	patchLine: (line: Line) => Line
) {
	const sections = blocks.flatMap((b) => (b.type === 'section' ? [patchSection(b.section)] : []));
	const lines = blocks
		.flatMap((b) => (b.type === 'section' && b.isRepeat ? [] : b.lines))
		.map(patchLine)
		.sort((a, b) => a.order - b.order);
	const linesBySection = new Map<Id<'SongSection'>, Line[]>();
	for (const line of lines)
		if (line.parentRef.type === 'SongSection')
			linesBySection.set(line.parentRef._id, [
				...(linesBySection.get(line.parentRef._id) ?? []),
				line
			]);
	return buildArrangement(
		sections,
		lines.filter((line) => line.parentRef.type === 'Song'),
		linesBySection
	);
}

export class SongEditorState {
	#client = useConvexClient();
	/** The URL's song id, which is also getArrangement's argument: optimistic updates patch that query. */
	readonly routeSongId: string;
	readonly songId: Id<'Song'>;

	/** Picker on touch screens, brackets with a keyboard; a per-device preference. Plan §10.1. */
	#modePreference = new PersistedState<ChordEntryMode>(
		'chord-entry-mode',
		typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
			? 'picker'
			: 'brackets'
	);
	#mounted = new IsMounted();
	/**
	 * How chords are entered, once it's known: undefined in the server render and while it hydrates, which can't
	 * see a per-device setting. Until then lines look as this kind of screen's default mode shows them
	 * (line-editor).
	 */
	get mode() {
		return this.#mounted.current ? this.#modePreference.current : undefined;
	}
	setMode(mode: ChordEntryMode) {
		this.#modePreference.current = mode;
	}
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

	/* ---------- Saving ---------- */

	#saving = $state(0);
	#failed = $state(false);
	/** Lines with typing that hasn't been sent yet (it saves after a pause, or when the line loses focus). */
	drafts = new SvelteSet<string>();
	/** What the save status says: anything still to save, else whether the last save failed. */
	status = $derived<'saving' | 'saved' | 'failed'>(
		this.#saving || this.drafts.size ? 'saving' : this.#failed ? 'failed' : 'saved'
	);

	/**
	 * Every editor write goes through here, so the save status counts it and a failure is said out loud (Convex
	 * has already rolled back its optimistic update, so the change is gone from the screen). Resolves to the
	 * mutation's result, or undefined when it failed.
	 */
	async #save<Mutation extends FunctionReference<'mutation'>>(
		mutation: Mutation,
		args: FunctionArgs<Mutation>,
		optimisticUpdate?: (store: OptimisticLocalStore) => void
	): Promise<FunctionReturnType<Mutation> | undefined> {
		this.#saving++;
		try {
			const result = await this.#client.mutation(mutation, args, { optimisticUpdate });
			this.#failed = false;
			return result;
		} catch (error) {
			console.error(error);
			this.#failed = true;
			toast.error(errorMessage(error, 'Couldn’t save your last change. Try again.'));
			return undefined;
		} finally {
			this.#saving--;
		}
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
		return this.#save(api.song_edit.setCharacters, { lineId, characters }, (store) =>
			this.#patchLines(store, (line) => (line._id === lineId ? { ...line, characters } : line))
		);
	}

	replaceLine(lineId: Id<'SongLine'>, lines: ChartCharacter[][]) {
		return this.#save(api.song_edit.replaceLine, { lineId, lines }, (store) =>
			this.#patchLines(store, (line) =>
				line._id === lineId ? { ...line, characters: lines[0]! } : line
			)
		);
	}

	addLine(parentRef: Line['parentRef'], afterOrder?: number) {
		return this.#save(api.song_edit.addLine, { parentRef, afterOrder });
	}

	/** `joined` is the line above with this one appended, shown while it saves. */
	mergeLineUp(lineId: Id<'SongLine'>, previousId: Id<'SongLine'>, joined: ChartCharacter[]) {
		return this.#save(api.song_edit.mergeLineUp, { lineId }, (store) =>
			this.#patchBlocks(store, (blocks) =>
				blocks.map((block) => ({
					...block,
					lines: block.lines
						.filter((line) => line._id !== lineId)
						.map((line) => (line._id === previousId ? { ...line, characters: joined } : line))
				}))
			)
		);
	}

	/**
	 * Deletes a line, words and all, with Undo in the toast. When it starts a group, the line after it starts
	 * the group in its place, so the rest of the group doesn't merge into the one above.
	 */
	async removeLine(line: Line, next: Line | undefined) {
		const heir = line.startsGroup && next && !next.startsGroup ? next._id : undefined;
		const removed = await this.#save(
			api.song_edit.removeLine,
			{ lineId: line._id, heirId: heir },
			(store) =>
				this.#patchBlocks(store, (blocks) =>
					blocks
						.map((block) => ({
							...block,
							lines: block.lines
								.filter((l) => l._id !== line._id)
								.map(withMarks(heir ? [{ lineId: heir, startsGroup: true }] : []))
						}))
						.filter((block) => block.type === 'section' || block.lines.length)
				)
		);
		if (removed === undefined) return;
		const { parentRef, order, kindTag, characters, startsGroup } = line;
		toast(characters.length ? 'Line deleted' : 'Empty line deleted', {
			action: {
				label: 'Undo',
				onClick: () =>
					void this.#save(api.song_edit.restoreLine, {
						line: { parentRef, order, kindTag, characters, startsGroup },
						heirId: heir
					})
			}
		});
	}

	/**
	 * Moves a line, showing it at `order` (between its neighbours) while the server places it for real.
	 * `marks` keep the line groups as they look after the drop.
	 */
	moveLine(args: FunctionArgs<typeof api.song_edit.moveLine>, order: number) {
		const mark = withMarks(args.marks);
		return this.#save(api.song_edit.moveLine, args, (store) =>
			this.#patchBlocks(store, (blocks) =>
				rebuild(
					blocks,
					(section) => section,
					(line) =>
						mark(line._id === args.lineId ? { ...line, parentRef: args.parentRef, order } : line)
				)
			)
		);
	}

	setGroupMarks(marks: GroupMark[]) {
		return this.#save(api.song_edit.setGroupMarks, { marks }, (store) =>
			this.#patchLines(store, withMarks(marks))
		);
	}

	/** Where a block's lines live: its section, or the song itself for loose lines. */
	parentRefOf(block: ArrangementBlock): Line['parentRef'] {
		return block.type === 'section'
			? { type: 'SongSection', _id: block.section._id }
			: { type: 'Song', _id: this.songId };
	}

	/** True from Enter, Backspace or a paste until the line it's for has focus: every line holds typing. */
	linesChanging = $state(false);
	/** Words typed while lines were changing, for that line. */
	held = '';

	/**
	 * Splits or joins lines. `change` saves, and gives the line to focus and where its caret goes. Typing is
	 * held from now until that line has focus (see focused), then typed into it. If it failed, nothing is held.
	 */
	async changeLines(change: () => Promise<FocusRequest | undefined>) {
		this.linesChanging = true;
		const request = await change();
		if (request) this.focusRequest = request;
		else this.linesChanging = false;
	}

	/** Focuses a line once it renders (a new line from Add line). */
	focusLine(lineId: string, caret: number) {
		this.focusRequest = { lineId, caret };
	}

	/** The requested line has focus, so typing goes straight to it now. Returns what was held for it. */
	focused() {
		this.focusRequest = null;
		this.linesChanging = false;
		const held = this.held;
		this.held = '';
		return held;
	}

	/* ---------- Blocks ---------- */

	createSection(name: string, kindTag: Doc<'SongSection'>['kindTag'], lineIds?: Id<'SongLine'>[]) {
		return this.#save(api.song_edit.createSection, {
			songId: this.songId,
			name,
			kindTag,
			lineIds
		});
	}

	renameSection(sectionId: Id<'SongSection'>, name: string) {
		return this.#save(api.song_edit.renameSection, { sectionId, name }, (store) =>
			this.#patchBlocks(store, (blocks) =>
				blocks.map((block) =>
					block.type === 'section' && block.section._id === sectionId
						? { ...block, section: { ...block.section, name } }
						: block
				)
			)
		);
	}

	removeSection(sectionId: Id<'SongSection'>) {
		return this.#save(api.song_edit.removeSection, { sectionId }, (store) =>
			this.#patchBlocks(store, (blocks) =>
				blocks.filter(
					(block) =>
						block.type !== 'section' ||
						(block.section._id !== sectionId && block.source._id !== sectionId)
				)
			)
		);
	}

	/** Plays a block again at the end of the song, and scrolls there so the new repeat is seen. */
	async repeatSection(sectionId: Id<'SongSection'>) {
		const id = await this.#save(api.song_edit.repeatSection, { sectionId });
		if (id) await this.reveal(id);
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
		return this.#save(api.song_edit.reorder, { songId: this.songId, items }, (store) => {
			const reorder = <T extends { _id: string; order: number }>(row: T) =>
				orders.has(row._id) ? { ...row, order: orders.get(row._id)! } : row;
			this.#patchBlocks(store, (blocks) => rebuild(blocks, reorder, reorder));
		});
	}

	/** Scrolls to a block and flashes it (a new repeat, or "edit the original" on one). */
	async reveal(sectionId: string) {
		await tick();
		document
			.getElementById(`block-${sectionId}`)
			?.scrollIntoView({ behavior: reduced() ? 'instant' : 'smooth', block: 'center' });
		this.highlighted = sectionId;
		setTimeout(() => {
			if (this.highlighted === sectionId) this.highlighted = null;
		}, 1800);
	}
}

export const [getSongEditor, setSongEditor] = createContext<SongEditorState>();
