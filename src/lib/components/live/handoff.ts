import { fade, fly } from 'svelte/transition';
import { ms } from '#lib/motion.js';

/*
 * The live view hands one song or group over to the next in place: old and new share one grid cell, the old fades
 * out quickly and the new one arrives once it's gone, so their words never print over each other. Everything that
 * belongs to the song (title, words, credits, progress) uses these, so the whole stage changes in one beat.
 */
export const handOut = (node: Element) => fade(node, { duration: ms(120) });

/** `y` rises it into place as it fades in (the words); without it, it only fades. */
export const handIn = (node: Element, { y = 0 } = {}) =>
	fly(node, { y, duration: ms(320), delay: ms(120) });
