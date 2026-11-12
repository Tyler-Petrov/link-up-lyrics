<script lang="ts">
	/*
	 * A song's credits, small and muted under the words: its copyright line, its CCLI song number, and the
	 * church's CCLI license number. Licenses require the attribution (plan §18.7). Renders nothing without any.
	 */
	type Props = {
		copyrightLine?: string;
		ccliSongNumber?: string;
		ccliLicenseNumber?: string;
		class?: string;
	};
	let { copyrightLine, ccliSongNumber, ccliLicenseNumber, class: className }: Props = $props();
</script>

{#if copyrightLine || ccliSongNumber || ccliLicenseNumber}
	<p
		class={[
			'flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-xs text-muted-foreground',
			className
		]}
	>
		{#if copyrightLine}<span>{copyrightLine}</span>{/if}
		{#if ccliSongNumber}<span>CCLI Song #{ccliSongNumber}</span>{/if}
		{#if ccliLicenseNumber}<span>CCLI License #{ccliLicenseNumber}</span>{/if}
	</p>
{/if}
