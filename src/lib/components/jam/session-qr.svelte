<script lang="ts">
	import { encode, QrCodeDataType } from 'uqr';
	import { cn } from '#lib/utils.js';

	/*
	 * The live page's QR, drawn here (server and browser alike) rather than fetched: cream rounded modules on
	 * brown, like the old app, with soft "eyes" for the three finder patterns. Plan §11.
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
	const padding = 2.5;
</script>

<div class={cn('rounded-3xl bg-choco-8 p-3 shadow-inner shadow-black/30', className)}>
	<svg
		viewBox="{-padding} {-padding} {qr.size + padding * 2} {qr.size + padding * 2}"
		class="block h-auto w-full"
		role="img"
		aria-label="QR code for {url}"
	>
		<g fill="#fce1bc">
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
					stroke="#fce1bc"
					stroke-width="1"
				/>
				<rect x={x! + 2} y={y! + 2} width="3" height="3" rx="0.9" />
			{/each}
		</g>
	</svg>
</div>
