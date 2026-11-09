<script lang="ts">
	/*
	 * Songs shown live in the sessions you host, for your church's CCLI report: small-group nights are the
	 * usage that otherwise never gets reported. Filter by date, check the table, download a CSV. §18.4.
	 */
	import { fade } from 'svelte/transition';
	import Download from '@lucide/svelte/icons/download';
	import { api } from '#convex/_generated/api.js';
	import { constantByTag } from '#convex/constants.js';
	import { convexQuery } from '#lib/convex-query.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	/** A local date as yyyy-mm-dd, the value an <input type="date"> holds. */
	const dateValue = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	/** Local midnight at the start of a yyyy-mm-dd day, `plusDays` later. */
	const startOfDay = (value: string, plusDays = 0) => {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year!, month! - 1, day! + plusDays).getTime();
	};

	const today = new Date();
	let from = $state(dateValue(new Date(today.getFullYear(), today.getMonth() - 2, 1)));
	let to = $state(dateValue(today));
	const range = $derived.by(() => {
		const fromEpoch = from ? startOfDay(from) : NaN;
		const toEpoch = to ? startOfDay(to, 1) : NaN;
		return Number.isNaN(fromEpoch) || Number.isNaN(toEpoch) || fromEpoch >= toEpoch
			? undefined
			: { fromEpoch, toEpoch };
	});
	const rows = $derived(range ? await convexQuery(api.ccli.usage, range) : []);

	const shown = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	const copyright = (row: (typeof rows)[number]) =>
		row.copyrightLine ??
		(row.copyrightSourceTag ? constantByTag('CopyrightSources', row.copyrightSourceTag).name : '');

	function downloadCsv() {
		const cell = (value: string | undefined) => `"${(value ?? '').replaceAll('"', '""')}"`;
		const lines = [
			['Date', 'Title', 'Artist', 'CCLI Song Number', 'Copyright', 'Session'],
			...rows.map((row) => [
				dateValue(new Date(row.usedEpoch)),
				row.title,
				row.artist,
				row.ccliSongNumber,
				copyright(row),
				row.jamSessionName
			])
		];
		const blob = new Blob([lines.map((line) => line.map(cell).join(',')).join('\r\n')], {
			type: 'text/csv;charset=utf-8'
		});
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `song-usage-${from}-to-${to}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-end gap-3">
		<div class="flex flex-col gap-1.5">
			<Label for="usage-from">From</Label>
			<Input id="usage-from" type="date" bind:value={from} max={to} class="h-10 w-40 rounded-xl" />
		</div>
		<div class="flex flex-col gap-1.5">
			<Label for="usage-to">To</Label>
			<Input id="usage-to" type="date" bind:value={to} min={from} class="h-10 w-40 rounded-xl" />
		</div>
		<Button
			variant="secondary"
			class="ml-auto h-10 rounded-xl"
			disabled={rows.length === 0}
			onclick={downloadCsv}
		>
			<Download /> Download CSV
		</Button>
	</div>

	{#if rows.length === 0}
		<p in:fade class="rounded-xl bg-background/40 p-6 text-center text-sm text-muted-foreground">
			{range
				? 'Nothing in these dates. Songs show up here once you show them in a live session.'
				: 'Pick a start date on or before the end date.'}
		</p>
	{:else}
		<div in:fade class="overflow-x-auto rounded-xl bg-background/40">
			<table class="w-full min-w-[40rem] text-left text-sm">
				<thead class="text-xs text-muted-foreground">
					<tr>
						<th class="px-3 py-2 font-medium">Date</th>
						<th class="px-3 py-2 font-medium">Song</th>
						<th class="px-3 py-2 font-medium">CCLI #</th>
						<th class="px-3 py-2 font-medium">Copyright</th>
						<th class="px-3 py-2 font-medium">Session</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row._id)}
						<tr class="border-t border-border align-top">
							<td class="px-3 py-2 whitespace-nowrap">{shown.format(row.usedEpoch)}</td>
							<td class="px-3 py-2">
								<p class="font-medium">{row.title}</p>
								{#if row.artist}<p class="text-xs text-muted-foreground">{row.artist}</p>{/if}
							</td>
							<td class="px-3 py-2 font-chart">
								{#if row.ccliSongNumber}{row.ccliSongNumber}{:else}<span
										class="text-muted-foreground">—</span
									>{/if}
							</td>
							<td class="px-3 py-2 text-muted-foreground">{copyright(row) || '—'}</td>
							<td class="px-3 py-2">{row.jamSessionName}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
