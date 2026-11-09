// Drag-to-reorder as an attachment: `{@attach sortable({ onUpdate: ({ newIds }) => … })}` on the list, with a
// `data-id` on each child. A failed save restores the order and toasts. From Jairus.
import { on } from 'svelte/events';
import type { Attachment } from 'svelte/attachments';
import Sortable, {
	type SortableEvent,
	type SortableOptions as SortableOptionsBase
} from 'sortablejs';
import { tick } from 'svelte';
import { toast } from 'svelte-sonner';

export function isTouchDevice() {
	return window.matchMedia('(pointer: coarse)').matches;
}

type MaybePromise<T> = T | Promise<T>;

type SortableUpdateEvent = SortableEvent & { newIds: string[] };

type SortableOptions = Omit<SortableOptionsBase, 'onAdd' | 'onUpdate' | 'filter' | 'store'> & {
	onAdd?: (event: SortableUpdateEvent) => MaybePromise<void>;
	onUpdate?: (event: SortableUpdateEvent) => MaybePromise<void>;
	filter?: string;
	store?: {
		get?: NonNullable<SortableOptionsBase['store']>['get'];
		set: NonNullable<SortableOptionsBase['store']>['set'];
	};
};

const childOrderBeforeDrag = new WeakMap<HTMLElement, HTMLElement[]>();
const sortableInstances = new WeakMap<HTMLElement, Sortable>();

function hasExactChildOrder(element: HTMLElement, expectedOrder: HTMLElement[]) {
	const currentOrder = Array.from(element.children);
	return (
		currentOrder.length === expectedOrder.length &&
		currentOrder.every((child, index) => child === expectedOrder[index])
	);
}

function restoreOrderAfterFailedSave(
	event: SortableEvent,
	previousSourceOrder: HTMLElement[] | undefined,
	sourceOrderAfterDrop: HTMLElement[],
	targetOrderAfterDrop: HTMLElement[]
) {
	if (!previousSourceOrder) return false;
	if (!hasExactChildOrder(event.from, sourceOrderAfterDrop)) return false;
	if (!hasExactChildOrder(event.to, targetOrderAfterDrop)) return false;

	if (event.from === event.to) {
		previousSourceOrder.forEach((child) => event.from.append(child));
		return true;
	}

	event.from.append(event.item);
	previousSourceOrder.forEach((child) => event.from.append(child));
	return true;
}

export function sortable(options: SortableOptions = {}): Attachment<HTMLElement> {
	return (element) => {
		const abortController = new AbortController();
		const handleUpdate = (
			event: SortableEvent,
			callback: NonNullable<SortableOptions['onAdd']>
		) => {
			const previousSourceOrder = childOrderBeforeDrag.get(event.from);
			childOrderBeforeDrag.delete(event.from);
			const sourceOrderAfterDrop = Array.from(event.from.children) as HTMLElement[];
			const targetOrderAfterDrop =
				event.from === event.to
					? sourceOrderAfterDrop
					: (Array.from(event.to.children) as HTMLElement[]);
			const newIds = Array.from(event.to.children)
				.map((child) => child.getAttribute('data-id'))
				.filter((id): id is string => !!id);

			const lockedSortables = [...new Set([event.from, event.to])]
				.map((element) => ({
					element,
					instance: sortableInstances.get(element)
				}))
				.filter(
					(
						sortable
					): sortable is {
						element: HTMLElement;
						instance: Sortable;
					} => sortable.instance !== undefined
				)
				.map((sortable) => ({
					...sortable,
					wasDisabled: sortable.instance.option('disabled') as boolean
				}));
			lockedSortables.forEach(({ instance }) => instance.option('disabled', true));

			void tick().then(async () => {
				try {
					await callback({
						...event,
						newIds
					});
				} catch (error) {
					const restored = restoreOrderAfterFailedSave(
						event,
						previousSourceOrder,
						sourceOrderAfterDrop,
						targetOrderAfterDrop
					);
					console.error('Failed to save sortable order', error);
					toast.warning(
						restored
							? "Couldn't save the new order. The list was restored."
							: "Couldn't save the new order. Refresh to restore the saved order."
					);
				} finally {
					lockedSortables.forEach(({ element, instance, wasDisabled }) => {
						if (sortableInstances.get(element) === instance) {
							instance.option('disabled', wasDisabled);
						}
					});
				}
			});
		};

		const onAdd = options.onAdd ?? options.onUpdate;
		const onUpdate = options.onUpdate;

		const sortableInstance = new Sortable(element, {
			animation: 150,
			fallbackTolerance: 3, // So that we can select items on mobile
			delay: 500,
			delayOnTouchOnly: true,
			fallbackOnBody: true,
			swapThreshold: 0.5,
			forceFallback: isTouchDevice(),
			...options,
			store: options.store && {
				get: options.store.get ?? ((s) => s.toArray()),
				set: options.store.set
			},
			emptyInsertThreshold: options.emptyInsertThreshold ?? 15,
			onAdd: onAdd && ((event) => handleUpdate(event, onAdd)),
			onUpdate: onUpdate && ((event) => handleUpdate(event, onUpdate)),
			onStart: (event) => {
				childOrderBeforeDrag.set(element, Array.from(element.children) as HTMLElement[]);
				options.onStart?.(event);
			},
			filter: `[data-slot="empty"], .no-sort, ${options.filter ?? ''}`,
			ghostClass: 'sortable-ghost',
			dragClass: 'sortable-drag',
			chosenClass: 'sortable-chosen'
		});
		sortableInstances.set(element, sortableInstance);

		const previousTouchCallout = element.style.getPropertyValue('-webkit-touch-callout');
		const previousTouchCalloutPriority = element.style.getPropertyPriority('-webkit-touch-callout');
		let activePointerType: string | null = null;

		// iPadOS can show its native callout before firing `contextmenu`.
		element.style.setProperty('-webkit-touch-callout', 'none');
		on(
			element,
			'pointerdown',
			(event) => {
				activePointerType = event.pointerType;
			},
			{
				signal: abortController.signal
			}
		);
		on(
			window,
			'pointerup',
			() => {
				activePointerType = null;
			},
			{
				signal: abortController.signal
			}
		);
		on(
			window,
			'pointercancel',
			() => {
				activePointerType = null;
			},
			{
				signal: abortController.signal
			}
		);
		on(
			element,
			'contextmenu',
			(event) => {
				const pointerType = event instanceof PointerEvent ? event.pointerType : activePointerType;
				if (pointerType && pointerType !== 'mouse') {
					event.preventDefault();
				}
			},
			{
				signal: abortController.signal
			}
		);

		return () => {
			abortController.abort();
			sortableInstances.delete(element);
			sortableInstance.destroy();
			if (previousTouchCallout) {
				element.style.setProperty(
					'-webkit-touch-callout',
					previousTouchCallout,
					previousTouchCalloutPriority
				);
			} else {
				element.style.removeProperty('-webkit-touch-callout');
			}
		};
	};
}
