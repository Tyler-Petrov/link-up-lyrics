import { reduced } from '#lib/motion.js';

const shown = new WeakSet<Element>();

/**
 * An attachment that keeps the element in view while `on`, for following the current group on the live page and
 * the console. It glides when the focus moves between things already on screen, and jumps at once when the
 * element just appeared (a new song, a new view, a page load), so a fresh song never races past while it fades in.
 */
export const follow =
	(on: boolean, block: ScrollLogicalPosition = 'nearest') =>
	(element: Element) => {
		const appeared = !shown.has(element);
		shown.add(element);
		if (on)
			element.scrollIntoView({ block, behavior: appeared || reduced() ? 'instant' : 'smooth' });
	};
