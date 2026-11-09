/*
 * One motion vocabulary for the app, from Beacon (Jairus). Use these instead of fade/slide/flip/scale with typed
 * durations, so everything moves with the same feel and is instant for people who ask for reduced motion.
 * Svelte runs transitions with the Web Animations API, which the reduced-motion rule in app.css can't reach.
 *
 *   animate:glide      keyed items sliding to their new place when the order changes
 *   transition:reveal  blocks that open and close (grow and shrink in place)
 *   transition:appear  small inline things: words, counts, chips
 *   transition:pop     cards and panels entering or leaving
 *
 * For a one-off (a fly, a horizontal slide), pass `duration: ms(…)` so it still honours reduced motion.
 */
import { flip } from 'svelte/animate';
import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import { fade, scale, slide } from 'svelte/transition';

/** Whether the person asked for reduced motion, e.g. for `scrollIntoView({ behavior })`. */
export const reduced = () => prefersReducedMotion.current;

/** The duration, or 0 under reduced motion. */
export const ms = (duration: number) => (reduced() ? 0 : duration);

export const glide = (node: Element, fromTo: { from: DOMRect; to: DOMRect }) =>
	flip(node, fromTo, {
		duration: (distance) => ms(Math.min(420, Math.max(180, Math.sqrt(distance) * 16))),
		easing: cubicOut
	});

export const reveal = (node: Element) => slide(node, { duration: ms(200), easing: cubicOut });

export const appear = (node: Element) => fade(node, { duration: ms(150) });

export const pop = (node: Element) =>
	scale(node, { start: 0.96, opacity: 0, duration: ms(200), easing: cubicOut });
