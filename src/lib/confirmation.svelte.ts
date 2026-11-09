/*
 * `if (await confirmation({ title: 'Delete', message: '…' })) …` — one app-wide confirm dialog
 * (components/confirmation-dialog.svelte, mounted in the root layout). From Jairus, on runes.
 */
export type ConfirmationProps = {
	title?: string;
	message?: string;
	variant?: 'default' | 'destructive';
	/** When set, the person has to type this to confirm. */
	confirmationString?: string;
	/** Defaults to "Cancel". */
	cancelLabel?: string;
	/** Defaults to the title. */
	confirmLabel?: string;
};

type ConfirmationState = Required<Pick<ConfirmationProps, 'title' | 'message' | 'variant'>> &
	Omit<ConfirmationProps, 'title' | 'message' | 'variant'> & {
		open: boolean;
		resolve?: (confirmed: boolean) => void;
	};

export const confirmationState: ConfirmationState = $state({
	open: false,
	title: '',
	message: '',
	variant: 'destructive'
});

export function confirmation({
	title = 'Confirm',
	message = 'Are you sure?',
	variant = 'destructive',
	confirmationString,
	cancelLabel,
	confirmLabel
}: ConfirmationProps) {
	confirmationState.resolve?.(false);
	return new Promise<boolean>((resolve) => {
		Object.assign(confirmationState, {
			open: true,
			title,
			message,
			variant,
			confirmationString,
			cancelLabel,
			confirmLabel,
			resolve
		});
	});
}

/** Settles the open confirmation. The dialog calls this; nothing else should. */
export function settleConfirmation(confirmed: boolean) {
	const resolve = confirmationState.resolve;
	confirmationState.resolve = undefined;
	confirmationState.open = false;
	resolve?.(confirmed);
}
