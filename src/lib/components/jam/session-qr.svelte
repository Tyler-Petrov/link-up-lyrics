<script lang="ts">
	import { encode, QrCodeDataType } from 'uqr';
	import { cn } from '#lib/utils.js';

	/*
	 * The live page's QR, drawn here (server and browser alike) rather than fetched: rounded modules in the
	 * text colour on the page colour (callers can recolour both), with soft "eyes" for the three finder
	 * patterns, and the four-module quiet zone scanners expect. Plan §11.
	 */
	let { url, class: className }: { url: string; class?: string } = $props();

	const qr = $derived(encode(url, { ecc: 'M', border: 0 }));
	const modules = $derived(
		qr.data.flatMap((row, y) =>
			row.flatMap((dark, x) =>
				dark && qr.types[y]![x] !== QrCodeDataType.Position ? [{ x, y }] : []
			)
		)
	);
	const eyes = $derived([
		[0, 0],
		[qr.size - 7, 0],
		[0, qr.size - 7]
	]);
	const padding = 4;
</script>

<div
	class={cn('rounded-3xl bg-background text-foreground shadow-inner shadow-black/30', className)}
>
	<svg
		viewBox="{-padding} {-padding} {qr.size + padding * 2} {qr.size + padding * 2}"
		class="block h-auto w-full"
		role="img"
		aria-label="QR code for {url}"
	>
		<g fill="currentColor">
			{#each modules as module (`${module.x}:${module.y}`)}
				<rect x={module.x + 0.08} y={module.y + 0.08} width="0.84" height="0.84" rx="0.32" />
			{/each}
			{#each eyes as [x, y] (`${x}:${y}`)}
				<rect
					x={x! + 0.5}
					y={y! + 0.5}
					width="6"
					height="6"
					rx="1.9"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
				/>
				<rect x={x! + 2} y={y! + 2} width="3" height="3" rx="0.9" />
			{/each}
		</g>
	</svg>
</div>
