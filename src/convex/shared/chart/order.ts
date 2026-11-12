/*
 * Fractional ordering: siblings sort by a number, and a new one goes between its neighbours, so inserting or
 * moving anything writes exactly one row. §4.2. Halving the same gap about 50 times runs out of float
 * precision; fitsBetween catches that, and the caller renumbers the parent's rows (rare, and a few hundred
 * rows at most).
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

/** Whether `orders` sort strictly between the neighbours, in sequence. False once a gap is exhausted. */
export function fitsBetween(
	before: number | undefined,
	after: number | undefined,
	orders: number[]
) {
	const all = [before, ...orders, after].filter((order) => order !== undefined);
	return all.every((order, i) => Number.isFinite(order) && (i === 0 || all[i - 1]! < order));
}
