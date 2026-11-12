<script lang="ts">
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { cn } from '#lib/utils.js';
	import { TextSizes, ViewModes, type ViewerSettings } from './viewer-settings.svelte.js';

	let { settings }: { settings: ViewerSettings } = $props();
	let open = $state(false);
</script>

<!-- A bottom sheet: within thumb reach, and the lyrics stay sharp above it, so a change shows as you make it. -->
<Dialog.Root bind:open>
	<Dialog.Trigger
		class="grid size-11 place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
		aria-label="View settings"
	>
		<SlidersHorizontal class="size-5" />
	</Dialog.Trigger>
	<Dialog.Content
		overlayClass="backdrop-blur-none"
		class="top-auto bottom-0 left-1/2 max-w-[min(100%-1rem,28rem)] translate-y-0 gap-5 rounded-t-3xl rounded-b-none bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-base sm:bottom-4 sm:max-w-md sm:rounded-3xl data-open:zoom-in-100 data-open:slide-in-from-bottom data-closed:zoom-out-100 data-closed:slide-out-to-bottom"
	>
		<Dialog.Header>
			<Dialog.Title class="text-lg">How this phone shows the words</Dialog.Title>
			<Dialog.Description>Saved on this device. No account needed.</Dialog.Description>
		</Dialog.Header>

		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Show
			</legend>
			{#each ViewModes as mode (mode.tag)}
				{@const selected = settings.mode === mode.tag}
				<label
					class={cn(
						'flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 transition-colors',
						selected ? 'border-primary bg-primary/10' : 'border-transparent bg-background/40'
					)}
				>
					<input
						type="radio"
						name="view-mode"
						value={mode.tag}
						class="sr-only"
						checked={selected}
						onchange={() => (settings.mode = mode.tag)}
					/>
					<!-- A tiny picture of the mode: bars for groups, the lit one is current. -->
					<span
						class="flex h-10 w-8 shrink-0 flex-col justify-center gap-1 rounded-lg bg-background/60 p-1.5"
						aria-hidden="true"
					>
						{#if mode.tag === 'song'}
							<span class="h-1 rounded-full bg-muted-foreground/30"></span>
							<span class="h-1.5 rounded-full bg-primary"></span>
							<span class="h-1 rounded-full bg-muted-foreground/30"></span>
							<span class="h-1 rounded-full bg-muted-foreground/30"></span>
						{:else}
							<span class="h-1.5 rounded-full bg-primary"></span>
							<span class="h-1.5 rounded-full bg-primary"></span>
							{#if mode.tag === 'next'}
								<span class="mt-1 h-1 rounded-full bg-muted-foreground/30"></span>
							{/if}
						{/if}
					</span>
					<span class="flex flex-col">
						<span class="font-semibold">{mode.name}</span>
						<span class="text-sm text-muted-foreground">{mode.description}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<fieldset>
			<legend class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Text size
			</legend>
			<div class="grid grid-cols-3 gap-1 rounded-2xl bg-background/40 p-1">
				{#each TextSizes as size, index (size.tag)}
					<label
						class={cn(
							'grid h-12 cursor-pointer place-items-center rounded-xl font-semibold transition-colors',
							settings.sizeTag === size.tag
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground'
						)}
					>
						<input
							type="radio"
							name="text-size"
							value={size.tag}
							class="sr-only"
							checked={settings.sizeTag === size.tag}
							onchange={() => (settings.sizeTag = size.tag)}
						/>
						<span style:font-size="{0.85 + index * 0.25}rem" aria-label={size.name}>Aa</span>
					</label>
				{/each}
			</div>
		</fieldset>
	</Dialog.Content>
</Dialog.Root>
