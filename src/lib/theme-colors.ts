/**
 * The browser chrome's colour (meta theme-color), which takes a plain colour rather than a CSS variable:
 * hex copies of --background in app.css (light, dark, and .stage for /live and the projector view).
 */
export const ThemeColors = {
	light: '#f5f7f9',
	dark: '#0c0f12',
	stage: '#060709'
} as const;
