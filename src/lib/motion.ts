/*
 * One motion vocabulary for the app, from Beacon (Jairus). Use these instead of fade/slide/flip/scale with typed
 * durations, so everything moves with the same feel and is instant for people who ask for reduced motion.
 * Svelte runs transitions with the Web Animations API, which the reduced-motion rule in app.css can't reach.
 *
 *   animate:glide      keyed items sliding to their new place when the order changes
 *   morph(update)      one change of the whole page (theme, a mode) as a view transition: a crossfade, and
 *                      elements with a view-transition-name move between their places
 *   transition:reveal  blocks that open and close (grow and shrink in place)
 *   transition:appear  small inline things: words, counts, chips
 *   transition:pop     cards and panels entering or leaving
 *
 * For a one-off (a fly, a horizontal slide), pass `duration: ms(…)` so it still honours reduced motion.
 */
import { tick } from 'svelte';
import type { AnimationConfig } from 'svelte/animate';
import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import { fade, scale, slide } from 'svelte/transition';

/** Whether the person asked for reduced motion, e.g. for `scrollIntoView({ behavior })`. */
export const reduced = () => prefersReducedMotion.current;

/** The duration, or 0 under reduced motion. */
export const ms = (duration: number) => (reduced() ? 0 : duration);

/**
 * Slides an item from its old place to its new one. Only moves it: a size change (a group gaining or losing
 * lines) lands at once, where flip's scale would stretch the words. Still for the reorder a drag and drop makes
 * (#lib/sortable marks the list): the drag already showed it.
 */
export function glide(node: Element, { from, to }: { from: DOMRect; to: DOMRect }): AnimationConfig {
	const dx = from.left - to.left;
	const dy = from.top - to.top;
	const still = (!dx && !dy) || node.parentElement?.hasAttribute('data-dropping');
	return {
		duration: still ? 0 : ms(Math.min(420, Math.max(180, Math.sqrt(Math.hypot(dx, dy)) * 16))),
		easing: cubicOut,
		css: (_t, u) => `transform: translate(${u * dx}px, ${u * dy}px)`
	};
}

export const reveal = (node: Element) => slide(node, { duration: ms(200), easing: cubicOut });

export const appear = (node: Element) => fade(node, { duration: ms(150) });

export const pop = (node: Element) =>
	scale(node, { start: 0.96, opacity: 0, duration: ms(200), easing: cubicOut });

/**
 * Runs `update`, which may be async, as one view transition; just runs it under reduced motion. Settles once the
 * change is done and has finished animating.
 */
export async function morph(update: () => unknown) {
	if (reduced() || !document.startViewTransition) return void (await update());
	const transition = document.startViewTransition(async () => {
		await update();
		await tick();
	});
	// Rejected when the browser skips the animation, though the update went fine.
	transition.ready.catch(() => undefined);
	await transition.finished;
}
