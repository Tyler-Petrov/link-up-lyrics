/*
 * How one phone shows the live page. Stored on the device (localStorage), so a singer never needs an account.
 */
import { PersistedState } from 'runed';

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

export function createViewerSettings() {
	const mode = new PersistedState<ViewModeTag>('live:viewMode', 'current');
	const size = new PersistedState<TextSizeTag>('live:textSize', 'm');
	return {
		get mode() {
			return ViewModes.some((m) => m.tag === mode.current) ? mode.current : 'current';
		},
		set mode(value: ViewModeTag) {
			mode.current = value;
		},
		get size() {
			return TextSizes.find((s) => s.tag === size.current) ?? TextSizes[1];
		},
		get sizeTag() {
			return this.size.tag;
		},
		set sizeTag(value: TextSizeTag) {
			size.current = value;
		}
	};
}
export type ViewerSettings = ReturnType<typeof createViewerSettings>;
