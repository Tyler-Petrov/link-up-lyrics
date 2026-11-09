/*
 * Forms validated by a valibot schema, trimmed from Jairus's form.svelte.ts. Errors show for a field once it's
 * been blurred, and for every field after a submit. `createConvexForm` submits `{ formData }` to a
 * valibotMutation (#convex/functions) and puts its field errors back on the form, so one schema validates
 * both sides.
 *
 *   const form = createConvexForm({ schema, mutation: api.song.createFromText, afterSuccessfulSubmit })
 *   <form onsubmit={form.onsubmit} onfocusout={form.onfocusout} oninput={form.oninput}>
 *     <Input name="title" bind:value={form.data.title} aria-invalid={!!form.errors.title} />
 */
import { useConvexClient } from 'convex-svelte';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { tick, untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import * as v from 'valibot';
import type { ValibotMutationResult } from '#convex/functions.js';

type FormData = Record<string, unknown>;
type MaybePromise<T> = T | Promise<T>;
export type SubmissionState = 'idle' | 'submitting' | 'submitted';

export type FormParameters<TSchema extends v.GenericSchema<FormData>> = {
	schema: TSchema;
	/** Read reactively: when it changes and the form is untouched, the form follows it. */
	initialData?: () => Partial<v.InferInput<TSchema>>;
	onSubmit: (props: {
		data: v.InferOutput<TSchema>;
		form: Form<TSchema>;
	}) => MaybePromise<void | { resetForm?: boolean }>;
};

/** The dotted path of an issue, like "songwriters.0". */
function issuePath(issue: v.BaseIssue<unknown>) {
	return (issue.path ?? []).map((item) => String(item.key)).join('.');
}

export class Form<TSchema extends v.GenericSchema<FormData>> {
	schema: TSchema;
	#onSubmit: FormParameters<TSchema>['onSubmit'];
	#initialData: () => Partial<v.InferInput<TSchema>>;

	data: Partial<v.InferInput<TSchema>> = $state({});
	#pristine = $state('{}');
	isTainted = $derived(JSON.stringify(this.data) !== this.#pristine);

	#issues: v.BaseIssue<unknown>[] = $state.raw([]);
	#customErrors: Record<string, string[]> = $state({});
	#blurred: string[] = $state([]);
	submissionState: SubmissionState = $state('idle');
	submissionError: unknown = $state.raw(undefined);

	/** Messages per field path, for fields the person has left or after a submit. */
	errors = $derived.by(() => {
		const errors: Record<string, string[]> = {};
		const add = (path: string, message: string) => (errors[path] ??= []).push(message);
		for (const issue of this.#issues) {
			const path = issuePath(issue);
			if (this.submissionState === 'submitted' || this.#blurred.includes(path))
				add(path, issue.message);
		}
		for (const [path, messages] of Object.entries(this.#customErrors))
			messages.forEach((m) => add(path, m));
		return errors;
	});

	constructor({ schema, initialData, onSubmit }: FormParameters<TSchema>) {
		this.schema = schema;
		this.#onSubmit = onSubmit;
		this.#initialData = initialData ?? (() => ({}));
		this.#setPristine(this.#initialData());

		// Follow initial data that arrives or changes later, unless the person has started typing.
		$effect.pre(() => {
			const initial = this.#initialData();
			untrack(() => {
				if (!this.isTainted && this.submissionState !== 'submitting') this.#setPristine(initial);
			});
		});
	}

	#setPristine(data: Partial<v.InferInput<TSchema>>) {
		this.data = structuredClone($state.snapshot(data) as Partial<v.InferInput<TSchema>>);
		this.#pristine = JSON.stringify(this.data);
	}

	async validate() {
		this.#customErrors = {};
		const result = await v.safeParseAsync(this.schema, $state.snapshot(this.data));
		this.#issues = result.success ? [] : result.issues;
		return result;
	}

	setFieldErrors(path: string, messages: string | string[]) {
		this.#customErrors[path] = Array.isArray(messages) ? messages : [messages];
	}

	reset(data?: Partial<v.InferInput<TSchema>>) {
		this.#issues = [];
		this.#customErrors = {};
		this.#blurred = [];
		this.submissionState = 'idle';
		this.submissionError = undefined;
		this.#setPristine({ ...this.#initialData(), ...data });
	}

	onfocusout = (event: FocusEvent) => {
		const name = (event.target as HTMLElement | null)?.getAttribute('name');
		if (name && !this.#blurred.includes(name)) this.#blurred.push(name);
		void this.validate();
	};

	oninput = () => {
		void this.validate();
	};

	onsubmit = async (event?: SubmitEvent) => {
		event?.preventDefault();
		if (this.submissionState === 'submitting') return;
		this.submissionState = 'submitting';
		this.submissionError = undefined;
		try {
			await tick();
			const result = await this.validate();
			if (!result.success) {
				this.submissionState = 'submitted';
				return;
			}
			const options = await this.#onSubmit({ data: result.output, form: this });
			this.submissionState = 'submitted';
			if (options?.resetForm !== false) this.reset();
		} catch (error) {
			this.submissionState = 'submitted';
			this.submissionError = error;
			toast.error(
				error instanceof ConvexError
					? String(error.data)
					: 'Something went wrong. Please try again.'
			);
			console.error(error);
		}
	};
}

type FormMutation<TSchema extends v.GenericSchema<FormData>> = FunctionReference<
	'mutation',
	'public',
	{ formData: v.InferOutput<TSchema> },
	ValibotMutationResult<unknown>
>;

/** A Form that submits to a valibotMutation. `state.open` is there for forms in dialogs. */
export function createConvexForm<
	TSchema extends v.GenericSchema<FormData>,
	TMutation extends FormMutation<TSchema>
>(
	params: Omit<FormParameters<TSchema>, 'onSubmit'> & {
		mutation: TMutation;
		afterSuccessfulSubmit?: (props: {
			data: v.InferOutput<TSchema>;
			response: Extract<TMutation['_returnType'], { success: true }>['response'];
		}) => MaybePromise<void>;
	}
) {
	const client = useConvexClient();
	const form = new Form({
		...params,
		onSubmit: async ({ data, form }) => {
			const result = (await client.mutation(params.mutation, {
				formData: data
			})) as ValibotMutationResult<
				Extract<TMutation['_returnType'], { success: true }>['response']
			>;
			if (!result.success) {
				result.errors.forEach((error) => form.setFieldErrors(error.key, error.message));
				return { resetForm: false };
			}
			state.open = false;
			await params.afterSuccessfulSubmit?.({ data, response: result.response });
		}
	});
	const state = $state({ open: false });
	return Object.assign(form, {
		state,
		/** Resets and opens the form's dialog. */
		resetOpen(data?: Partial<v.InferInput<TSchema>>) {
			form.reset(data);
			state.open = true;
		}
	});
}
