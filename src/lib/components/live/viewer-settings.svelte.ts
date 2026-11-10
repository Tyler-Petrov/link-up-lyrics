/*
 * How one phone shows the live page. Saved on the device in cookies, so a singer never needs an account, and the
 * server already renders the words in this phone's mode and size (from localStorage they'd swap in after load).
 */

export const ViewModes = Object.freeze([
	{ tag: 'current', name: 'Current group', description: 'Just what we’re singing now, large' },
	{ tag: 'next', name: 'Current + next', description: 'The next group dimmed underneath' },
	{ tag: 'song', name: 'Whole song', description: 'Everything, with the current group lit' }
] as const);

/* Sizes are relative to the stage's base size; the classes are literal so Tailwind sees them. */
export const TextSizes = Object.freeze([
	{ tag: 's', name: 'Small', class: 'text-[1.375rem]' },
	{ tag: 'm', name: 'Medium', class: 'text-[1.75rem]' },
	{ tag: 'l', name: 'Large', class: 'text-[2.25rem]' }
] as const);

export type ViewModeTag = (typeof ViewModes)[number]['tag'];
export type TextSizeTag = (typeof TextSizes)[number]['tag'];

/** The cookies the live page's server load reads for createViewerSettings. */
export const ViewerCookies = Object.freeze({ mode: 'live-view-mode', size: 'live-text-size' });

export function createViewerSettings(saved: { mode?: string; size?: string }) {
	let mode = $state(saved.mode);
	let size = $state(saved.size);
	const save = (name: string, value: string) => {
		document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
	};
	return {
		get mode(): ViewModeTag {
			return ViewModes.find((m) => m.tag === mode)?.tag ?? 'current';
		},
		set mode(value: ViewModeTag) {
			mode = value;
			save(ViewerCookies.mode, value);
		},
		get size() {
			return TextSizes.find((s) => s.tag === size) ?? TextSizes[1];
		},
		get sizeTag() {
			return this.size.tag;
		},
		set sizeTag(value: TextSizeTag) {
			size = value;
			save(ViewerCookies.size, value);
		}
	};
}
export type ViewerSettings = ReturnType<typeof createViewerSettings>;
