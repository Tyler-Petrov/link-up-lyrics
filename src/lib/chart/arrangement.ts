/*
 * A song renders as one ordered list of blocks: its sections and its loose lines merged by `order` (they
 * share one order space, §4.2), with repeats resolved to their source's lines. Line groups — what the
 * leader advances through live — are derived from it. Pure.
 */
import type { Doc, Id } from '#convex/_generated/dataModel.js';

type SectionLike = Pick<Doc<'SongSection'>, '_id' | 'order' | 'repeatOfId'>;
type LineLike = Pick<Doc<'SongLine'>, '_id' | 'order' | 'startsGroup'>;

export type ArrangementBlock<
	S extends SectionLike = Doc<'SongSection'>,
	L extends LineLike = Doc<'SongLine'>
> =
	| {
			type: 'section';
			/** Unique within the arrangement (a repeat has its own section id). */
			key: string;
			section: S;
			/** The section whose lines render: the section itself, or what it repeats. */
			source: S;
			isRepeat: boolean;
			lines: L[];
	  }
	| {
			/** A run of consecutive lines that belong to the song directly, not to a section. */
			type: 'loose';
			key: string;
			lines: L[];
	  };

export function buildArrangement<S extends SectionLike, L extends LineLike>(
	sections: S[],
	looseLines: L[],
	linesBySection: Map<Id<'SongSection'>, L[]>
): ArrangementBlock<S, L>[] {
	const sectionsById = new Map(sections.map((section) => [section._id, section]));
	const entries = [
		...sections.map((section) => ({ order: section.order, section })),
		...looseLines.map((line) => ({ order: line.order, line }))
	].sort((a, b) => a.order - b.order);

	const blocks: ArrangementBlock<S, L>[] = [];
	for (const entry of entries) {
		if ('line' in entry) {
			const last = blocks.at(-1);
			if (last?.type === 'loose') last.lines.push(entry.line);
			else blocks.push({ type: 'loose', key: entry.line._id, lines: [entry.line] });
			continue;
		}
		const { section } = entry;
		const source = (section.repeatOfId && sectionsById.get(section.repeatOfId)) || section;
		blocks.push({
			type: 'section',
			key: section._id,
			section,
			source,
			isRepeat: source !== section,
			lines: linesBySection.get(source._id) ?? []
		});
	}
	return blocks;
}

export type ChartGroup<L extends LineLike = Doc<'SongLine'>> = {
	/** Position in the whole song. Live focus is (setlist item, this index). */
	index: number;
	blockIndex: number;
	/** Unique within the arrangement, for keyed each blocks. */
	key: string;
	lines: L[];
};

/**
 * Splits each block at lines marked `startsGroup`. A block's first line always starts a group, so a block
 * with no markers is one group; groups never cross blocks; a repeat shares its source's lines and therefore
 * its groups. A block with no lines (a bare interlude) is still one, empty group.
 */
export function groupArrangement<L extends LineLike>(
	blocks: ArrangementBlock<SectionLike, L>[]
): ChartGroup<L>[] {
	const groups: ChartGroup<L>[] = [];
	blocks.forEach((block, blockIndex) => {
		const blockGroups: L[][] = [[]];
		block.lines.forEach((line, lineIndex) => {
			if (line.startsGroup && lineIndex > 0) blockGroups.push([]);
			blockGroups.at(-1)!.push(line);
		});
		for (const lines of blockGroups) {
			groups.push({
				index: groups.length,
				blockIndex,
				key: `${block.key}:${lines[0]?._id ?? 'empty'}`,
				lines
			});
		}
	});
	return groups;
}
