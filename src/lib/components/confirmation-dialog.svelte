<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { confirmationState, settleConfirmation } from '#lib/confirmation.svelte.js';

	let typed = $state('');
	const needsTyping = $derived(confirmationState.confirmationString !== undefined);
	const canConfirm = $derived(!needsTyping || typed === confirmationState.confirmationString);
</script>

<AlertDialog.Root
	bind:open={
		() => confirmationState.open,
		(open) => {
			if (!open) settleConfirmation(false);
			typed = '';
		}
	}
>
	<AlertDialog.Content class="rounded-2xl">
		<AlertDialog.Header>
			<AlertDialog.Title>{confirmationState.title}</AlertDialog.Title>
			<AlertDialog.Description class="whitespace-pre-wrap">
				{confirmationState.message}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if needsTyping}
			<label class="flex flex-col gap-2 text-sm font-medium">
				Type “{confirmationState.confirmationString}” to confirm
				<Input bind:value={typed} autocomplete="off" />
			</label>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{confirmationState.cancelLabel ?? 'Cancel'}</AlertDialog.Cancel>
			<AlertDialog.Action
				class={buttonVariants({
					variant: confirmationState.variant === 'destructive' ? 'destructive' : 'default'
				})}
				disabled={!canConfirm}
				onclick={() => settleConfirmation(true)}
			>
				{confirmationState.confirmLabel ?? confirmationState.title}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
