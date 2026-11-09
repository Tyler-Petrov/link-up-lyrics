/*
 * The project's function builders. Import `mutation` / `internalMutation` from here, never from
 * _generated/server: these run the triggers below on every write, so side effects of a change (cascades,
 * "last edited", invitation claims) live in one place instead of in each mutation.
 */
import { ConvexError, v, type PropertyValidators, type Validator } from 'convex/values';
import * as vb from 'valibot';
import { Triggers } from 'convex-helpers/server/triggers';
import { customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import type { DataModel, Doc, Id } from './_generated/dataModel';
import {
	internalMutation as rawInternalMutation,
	mutation as rawMutation,
	query,
	type MutationCtx
} from './_generated/server';
import { currentUser, ensureUser } from './model/user';
import { touchSong } from './model/song';
import { focusPatch, recordSongUsage } from './model/jam_session';

const triggers = new Triggers<DataModel>();

/** Deletes each document that still exists. Cascades can reach the same row twice (a repeat is both a */
/** section of the song and a repeat of a deleted section). */
async function deleteAll<
	T extends 'SongSection' | 'SongLine' | 'JamSessionItem' | 'JamSessionMember'
>(ctx: MutationCtx, table: T, docs: Doc<T>[]) {
	for (const doc of docs) {
		if (await ctx.db.get(table, doc._id as Id<T>)) await ctx.db.delete(table, doc._id as Id<T>);
	}
}

/* A new account claims the invitations sent to its email before it existed. §14.3. */
triggers.register('User', async (ctx, change) => {
	if (change.operation !== 'insert' || !change.newDoc.email) return;
	const invitations = await ctx.db
		.query('JamSessionMember')
		.withIndex('by_invitedEmail', (q) => q.eq('invitedEmail', change.newDoc.email))
		.take(100);
	for (const invitation of invitations) {
		if (invitation.userId) continue;
		await ctx.db.patch('JamSessionMember', invitation._id, {
			userId: change.id,
			invitedEmail: undefined
		});
	}
});

/* Deleting a song deletes its lines, sections and setlist appearances. */
triggers.register('Song', async (ctx, change) => {
	if (change.operation !== 'delete') return;
	const songId = change.id;
	await deleteAll(
		ctx,
		'SongLine',
		await ctx.db
			.query('SongLine')
			.withIndex('by_songId', (q) => q.eq('songId', songId))
			.take(4000)
	);
	await deleteAll(
		ctx,
		'SongSection',
		await ctx.db
			.query('SongSection')
			.withIndex('by_songId_and_order', (q) => q.eq('songId', songId))
			.take(1000)
	);
	await deleteAll(
		ctx,
		'JamSessionItem',
		await ctx.db
			.query('JamSessionItem')
			.withIndex('by_contentRef', (q) => q.eq('contentRef', { type: 'Song', _id: songId }))
			.take(1000)
	);
});

/* Deleting a section deletes its lines and its repeats. Any section change counts as an edit. */
triggers.register('SongSection', async (ctx, change) => {
	const section = change.newDoc ?? change.oldDoc;
	if (change.operation === 'delete') {
		const sectionId = change.id;
		await deleteAll(
			ctx,
			'SongLine',
			await ctx.db
				.query('SongLine')
				.withIndex('by_parentRef_and_order', (q) =>
					q.eq('parentRef', { type: 'SongSection', _id: sectionId })
				)
				.take(1000)
		);
		await deleteAll(
			ctx,
			'SongSection',
			await ctx.db
				.query('SongSection')
				.withIndex('by_repeatOfId', (q) => q.eq('repeatOfId', sectionId))
				.take(100)
		);
	}
	await touchSong(ctx, section.songId);
});

triggers.register('SongLine', async (ctx, change) => {
	await touchSong(ctx, (change.newDoc ?? change.oldDoc).songId);
});

/* A live session focusing a song records its use for the CCLI report. Deleting a session deletes its */
/* setlist and members. */
triggers.register('JamSession', async (ctx, change) => {
	if (change.newDoc) return await recordSongUsage(ctx, change.oldDoc, change.newDoc);
	const jamSessionId = change.id;
	await deleteAll(
		ctx,
		'JamSessionItem',
		await ctx.db
			.query('JamSessionItem')
			.withIndex('by_jamSessionId_and_order', (q) => q.eq('jamSessionId', jamSessionId))
			.take(1000)
	);
	await deleteAll(
		ctx,
		'JamSessionMember',
		await ctx.db
			.query('JamSessionMember')
			.withIndex('by_jamSessionId_and_statusTag', (q) => q.eq('jamSessionId', jamSessionId))
			.take(1000)
	);
});

/*
 * Removing the focused setlist item moves the focus to the next song, or clears it at the end of the set so
 * the live page shows "waiting" instead of nothing.
 */
triggers.register('JamSessionItem', async (ctx, change) => {
	if (change.operation !== 'delete') return;
	const { jamSessionId, order } = change.oldDoc;
	const session = await ctx.db.get('JamSession', jamSessionId);
	if (session?.focusedItemId !== change.id) return;
	const next = await ctx.db
		.query('JamSessionItem')
		.withIndex('by_jamSessionId_and_order', (q) =>
			q.eq('jamSessionId', jamSessionId).gt('order', order)
		)
		.first();
	await ctx.db.patch('JamSession', session._id, focusPatch(next?._id, 0));
});

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB));

/** A query for signed-in people. `ctx.user` is their User row; throws NOT_SIGNED_IN otherwise. */
export const authQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const user = await currentUser(ctx);
		if (!user) throw new ConvexError('NOT_SIGNED_IN');
		return { user };
	})
);

/** A mutation for signed-in people. `ctx.user` is their User row, created on first use. */
export const authMutation = customMutation(
	mutation,
	customCtx(async (ctx) => ({ user: await ensureUser(ctx) }))
);

/* ---------- Valibot form mutations (paired with #lib/form.svelte createConvexForm) ---------- */

/** What a form mutation returns: field errors stay on the form instead of throwing. */
export type ValibotMutationResult<TResponse> =
	| { success: true; response: TResponse }
	| { success: false; errors: { key: string; message: string }[] };

/** The Convex validator for a valibot schema, so one schema validates the form and the function's args. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function valibotToConvex(schema: vb.GenericSchema): Validator<any, 'required', any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const s = schema as any;
	switch (schema.type) {
		case 'object':
			return v.object(
				Object.fromEntries(
					Object.entries(s.entries as Record<string, vb.GenericSchema>).map(([key, value]) => [
						key,
						valibotToConvex(value)
					])
				)
			);
		case 'string':
			return v.string();
		case 'number':
			return v.number();
		case 'boolean':
			return v.boolean();
		case 'array':
			return v.array(valibotToConvex(s.item));
		case 'optional':
		case 'exact_optional':
			return v.optional(valibotToConvex(s.wrapped)) as unknown as Validator<
				unknown,
				'required',
				string
			>;
		case 'nullable':
			return v.union(v.null(), valibotToConvex(s.wrapped));
		case 'nullish':
			return v.optional(v.union(v.null(), valibotToConvex(s.wrapped))) as unknown as Validator<
				unknown,
				'required',
				string
			>;
		case 'picklist':
			return v.union(...(s.options as string[]).map((option) => v.literal(option)));
		case 'literal':
			return v.literal(s.literal);
		case 'union':
		case 'variant':
			return v.union(...(s.options as vb.GenericSchema[]).map(valibotToConvex));
		default:
			throw new Error(`valibotToConvex: unsupported schema type ${schema.type}`);
	}
}

/**
 * An authMutation taking `{ formData }` validated by a valibot schema (pipes included). Validation failures
 * come back as field errors; anything the handler throws as a ConvexError still throws.
 */
export function valibotMutation<TSchema extends vb.GenericSchema, TResponse>({
	schema,
	handler
}: {
	schema: TSchema;
	handler: (
		ctx: MutationCtx & { user: Doc<'User'> },
		data: vb.InferOutput<TSchema>
	) => Promise<TResponse>;
}) {
	return authMutation({
		args: { formData: valibotToConvex(schema) } as PropertyValidators,
		handler: async (
			ctx,
			args: { formData: vb.InferInput<TSchema> }
		): Promise<ValibotMutationResult<TResponse>> => {
			const result = vb.safeParse(schema, args.formData);
			if (!result.success) {
				return {
					success: false,
					errors: result.issues.map((issue) => ({
						key: (issue.path ?? []).map((item) => String(item.key)).join('.'),
						message: issue.message
					}))
				};
			}
			return { success: true, response: await handler(ctx, result.output) };
		}
	});
}
