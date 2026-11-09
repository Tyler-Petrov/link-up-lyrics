/*
 * Drag to reorder as an attachment, from Jairus (Beacon's model): `{@attach sortable({ onUpdate })}` on the parent
 * of a keyed {#each}, with `data-id` on each child. The callback runs with the drop still in the DOM, so it can
 * read where the item landed; then Sortable's own move is put back. Svelte stays the only thing that moves nodes:
 * the (optimistic) data change moves the item and animate:glide slides it there. A failed save rolls the data
 * back, so the list goes back by itself, and a toast says so.
 */
import Sortable, {
	type SortableEvent,
	type SortableOptions as SortableOptionsBase
} from 'sortablejs';
import type { Attachment } from 'svelte/attachments';
import { on } from 'svelte/events';
import { toast } from 'svelte-sonner';
import { reduced } from '#lib/motion.js';

type MaybePromise<T> = T | Promise<T>;

/** A drop, with the `data-id`s of the list it landed in, in their new order. */
export type SortableUpdateEvent = SortableEvent & { newIds: string[] };

type SortableOptions = Omit<SortableOptionsBase, 'onAdd' | 'onUpdate'> & {
	/** A drop within this list. */
	onUpdate?: (event: SortableUpdateEvent) => MaybePromise<void>;
	/** A drop from another list in the same `group`. Defaults to onUpdate. */
	onAdd?: (event: SortableUpdateEvent) => MaybePromise<void>;
};

export function sortable(options: SortableOptions = {}): Attachment<HTMLElement> {
	return (element) => {
		const onDrop =
			(callback: NonNullable<SortableOptions['onUpdate']> | undefined) =>
			(event: SortableEvent) => {
				if (!callback) return;
				const newIds = [...event.to.children]
					.map((child) => child.getAttribute('data-id'))
					.filter((id): id is string => !!id);
				const saved = (async () => callback({ ...event, newIds }))();

				event.item.remove();
				event.from.insertBefore(event.item, event.from.children[event.oldIndex!] ?? null);

				saved.catch((error) => {
					console.error('Failed to save the new order', error);
					toast.warning('Couldn’t save the new order, so it went back. Try again.');
				});
			};

		const instance = new Sortable(element, {
			animation: reduced() ? 0 : 150,
			fallbackTolerance: 3, // So a tap still selects on touch screens.
			delay: 500,
			delayOnTouchOnly: true,
			fallbackOnBody: true,
			swapThreshold: 0.5,
			emptyInsertThreshold: 15,
			forceFallback: matchMedia('(pointer: coarse)').matches,
			ghostClass: 'sortable-ghost',
			chosenClass: 'sortable-chosen',
			dragClass: 'sortable-drag',
			...options,
			onUpdate: onDrop(options.onUpdate),
			onAdd: onDrop(options.onAdd ?? options.onUpdate)
		});

		// iPadOS can show its native callout before firing `contextmenu`, so turn it off and swallow non-mouse ones.
		const previousCallout = element.style.getPropertyValue('-webkit-touch-callout');
		element.style.setProperty('-webkit-touch-callout', 'none');
		let pointerType: string | null = null;
		const listeners = [
			on(element, 'pointerdown', (event) => (pointerType = event.pointerType)),
			on(window, 'pointerup', () => (pointerType = null)),
			on(window, 'pointercancel', () => (pointerType = null)),
			on(element, 'contextmenu', (event) => {
				const type = event instanceof PointerEvent ? event.pointerType : pointerType;
				if (type && type !== 'mouse') event.preventDefault();
			})
		];

		return () => {
			listeners.forEach((off) => off());
			instance.destroy();
			if (previousCallout) element.style.setProperty('-webkit-touch-callout', previousCallout);
			else element.style.removeProperty('-webkit-touch-callout');
		};
	};
}
