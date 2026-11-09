import { on } from 'svelte/events';
// Long-press attachment, from Jairus.
import type { Attachment } from 'svelte/attachments';

export type Options = {
	ms?: number;
	thresholdPx?: number;
	/** Pointer types that start a press, such as `["touch", "pen"]`. All of them when omitted. */
	pointerTypes?: readonly string[];
	onLongPress: (e: PointerEvent) => void;
	onShortPress?: (e: PointerEvent) => void;
};

export function longpress(opts: Options): Attachment<HTMLElement> {
	return (node) => {
		const ms = opts.ms ?? 500;
		const thresholdPx = opts.thresholdPx ?? 10;

		const ac = new AbortController();
		const { signal } = ac;

		let t: number | null = null;
		let fired = false;
		let startX = 0;
		let startY = 0;

		// when true: swallow the very next click event
		let suppressClick = false;

		const clear = () => {
			if (t != null) window.clearTimeout(t);
			t = null;
		};

		const cancel = () => clear();

		on(
			node,
			'click',
			(e) => {
				if (!suppressClick) return;
				suppressClick = false;
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			},
			{ capture: true, signal }
		);

		on(
			node,
			'pointerdown',
			(e) => {
				if (opts.pointerTypes && !opts.pointerTypes.includes(e.pointerType)) return;
				if (e.pointerType === 'mouse' && e.button !== 0) return;

				fired = false;
				startX = e.clientX;
				startY = e.clientY;

				node.setPointerCapture?.(e.pointerId);

				clear();
				t = window.setTimeout(() => {
					fired = true;
					suppressClick = true; // next click gets swallowed
					opts.onLongPress(e);
				}, ms);
			},
			{ signal }
		);

		on(
			node,
			'pointermove',
			(e) => {
				if (t == null) return;
				const dx = e.clientX - startX;
				const dy = e.clientY - startY;
				if (dx * dx + dy * dy > thresholdPx * thresholdPx) cancel();
			},
			{ signal }
		);

		on(
			node,
			'pointerup',
			(e) => {
				const wasPending = t != null;
				clear();

				if (fired) {
					// helps on mobile where click is synthesized after pointerup
					e.preventDefault();
					return;
				}

				if (wasPending) opts.onShortPress?.(e);
			},
			{ signal }
		);

		on(node, 'pointercancel', cancel, { signal });
		on(node, 'pointerleave', cancel, { signal });

		return () => {
			ac.abort();
			clear();
		};
	};
}

export { longpress as default };
