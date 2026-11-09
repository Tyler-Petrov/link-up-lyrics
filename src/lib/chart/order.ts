/*
 * Fractional ordering: siblings sort by a number, and a new one goes between its neighbours, so inserting or
 * moving anything writes exactly one row. §4.2.
 */

/** An order between two neighbours. Either may be missing (start or end of the list). */
export function orderBetween(before: number | undefined, after: number | undefined) {
	if (before === undefined && after === undefined) return 0;
	if (before === undefined) return after! - 1;
	if (after === undefined) return before + 1;
	return (before + after) / 2;
}

/** Orders for appending `count` items after `last`. */
export function ordersAfter(last: number | undefined, count: number) {
	const start = last === undefined ? 0 : last + 1;
	return Array.from({ length: count }, (_, i) => start + i);
}

/** `count` evenly spaced orders between two neighbours (either may be missing), for moving a run of rows. */
export function ordersBetween(
	before: number | undefined,
	after: number | undefined,
	count: number
) {
	if (after === undefined) return ordersAfter(before, count);
	if (before === undefined) return Array.from({ length: count }, (_, i) => after - count + i);
	return Array.from(
		{ length: count },
		(_, i) => before + ((after - before) * (i + 1)) / (count + 1)
	);
}
