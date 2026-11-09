// From Jairus. `await convexQuery(api.x.y, args)` in a component: the first value comes from a one-off query
// (over HTTP with the user's token during SSR, embedded in the page for hydration), then a live subscription
// in the browser keeps it current. Deduped through cache.svelte.ts, so components can each load what they
// render without prop drilling. Plan §11.
import { useConvexClient } from 'convex-svelte';
import { createConvexHttpClient } from 'convex-svelte/sveltekit';
import type { ConvexClient } from 'convex/browser';
import { getFunctionName, type FunctionReference, type FunctionReturnType } from 'convex/server';
import { convexToJson } from 'convex/values';
import { cacheResource, type Cache } from './cache.svelte';
import { createContext, hydratable, tick, untrack } from 'svelte';
import { browser } from '$app/env';

/**
 * Runs a query once, over the browser's connection or over HTTP while server rendering.
 * A server render embeds the result in the page so hydration reuses it instead of waiting
 * on the browser's connection. For a failed query it embeds only that it failed, so the browser
 * runs it again.
 */
export async function queryOnce<Query extends FunctionReference<'query', 'public'>>(
	client: ConvexClient,
	query: Query,
	args: Query['_args']
): Promise<FunctionReturnType<Query>> {
	const run = (): Promise<FunctionReturnType<Query>> =>
		browser ? client.query(query, args) : createConvexHttpClient().query(query, args);

	type Embedded = { ok: true; value: FunctionReturnType<Query> } | { ok: false };
	const key = `convex:${generateCacheKey(query, args)}`;
	let request: Promise<FunctionReturnType<Query>> | undefined;
	const embedded = await (browser
		? takeEmbedded<Embedded>(key)
		: hydratable(key, () => {
				request = run();
				return request.then(
					(value): Embedded => ({ ok: true, value }),
					(): Embedded => ({ ok: false })
				);
			}));
	return embedded?.ok ? embedded.value : await (request ?? run());
}

/**
 * Svelte's `hydratable` only finds embedded values while it hydrates synchronously, so a query
 * first read after an `await` in a component's script would miss the server's result and fetch
 * it again while the page hydrates. In dev it also throws while hydrating for a query the server
 * didn't run, and the server only runs the queries its render awaits. Read the embedded value
 * directly instead. Each is used once, so the same query later on still fetches current data.
 */
function takeEmbedded<T>(key: string): Promise<T> | undefined {
	const store = (window as { __svelte?: { h?: Map<string, Promise<T>> } }).__svelte?.h;
	const value = store?.get(key);
	store?.delete(key);
	return value;
}

export class ConvexQuery<
	Query extends FunctionReference<'query', 'public'>,
	QueryResult = Query['_returnType']
> {
	unsubscribe: (() => void) | undefined = undefined;
	initialized = $state(false);
	#args: Query['_args'];

	#promise: Promise<QueryResult> | undefined;
	#startQuery: () => Promise<QueryResult>;
	#current: Query['_returnType'] | undefined = $state.raw(undefined);
	#error: unknown = $state.raw(undefined);

	constructor({ query, args }: { query: Query; args: Query['_args'] }) {
		const client = useConvexClient();

		this.#args = args;

		// Embedded results resolve within a microtask, which can run while Svelte still has an awaiting
		// derived's context restored. Untracked writes keep that from counting as a write inside it.
		this.#startQuery = async () => {
			try {
				const result = await queryOnce(client, query, this.#args);
				untrack(() => (this.#current = result));
				return result;
			} catch (error) {
				untrack(() => (this.#error = error));
				throw error;
			} finally {
				untrack(() => (this.initialized = true));
			}
		};
		// A server render waits on every query started during it before sending the page, so on the server a
		// query starts when the render first awaits it. Queries only the browser reads, like ones under a
		// pending boundary or read in an effect, would otherwise hold back the page for nothing.
		this.#promise = $state.raw(browser ? this.#startQuery() : undefined);

		/* Only subscribe to updates in the browser */
		if (browser) {
			this.unsubscribe = client.onUpdate(
				query,
				this.#args,
				(result: Query['_returnType']) => {
					// The first value is resolved by the promise, so we don't need to update the query here
					if (!this.initialized) return;

					this.#current = result;
					this.#error = undefined;
					this.#promise = Promise.resolve(result);
				},
				async (error) => {
					this.#current = undefined;
					this.#error = error;
					this.#promise = Promise.reject(error);
				}
			);
		}
	}

	get then() {
		// A getter rather than a $derived: the cache hands this query to components other than the one
		// that created it, and a $derived owned by a destroyed component returns its stale value.
		const promise = (this.#promise ??= this.#startQuery());

		return async (resolve: (value: QueryResult) => void, reject: (reason: unknown) => void) => {
			const result = promise.then(tick).then(() => this.#current as QueryResult);

			if (resolve || reject) {
				return result.then(resolve, reject);
			}

			return result;
		};
	}

	get current() {
		return this.#current;
	}

	get isLoading() {
		return !this.initialized;
	}

	/** Why the query failed. Awaiting it still throws; this is for reading `current` without awaiting. */
	get error() {
		return this.#error;
	}
}

export function generateCacheKey<Query extends FunctionReference<'query', 'public'>>(
	query: Query,
	args: Query['_args']
) {
	let encodedArgs;
	try {
		encodedArgs = convexToJson(args);
	} catch {
		const argsTypes = Object.fromEntries(
			Object.entries(args).map(([key, value]) => [key, typeof value])
		);
		throw new Error(
			`Invalid arguments for query ${getFunctionName(query)}: ${JSON.stringify(argsTypes)}`
		);
	}
	// Encoded, so arguments JSON can't represent (bigint, ArrayBuffer) still get a key.
	return `${getFunctionName(query)}-${JSON.stringify(encodedArgs)}`;
}

export function convexQuery<Query extends FunctionReference<'query', 'public'>>(
	query: Query,
	args: Query['_args']
) {
	const cacheKey = generateCacheKey(query, args);
	const createQuery = () => {
		if (import.meta.env.DEV) {
			console.debug('creating new ConvexQuery ' + getFunctionName(query));
		}
		return new ConvexQuery<Query>({ query, args });
	};

	const cache = getConvexQueryCache();
	return cacheResource(cache, cacheKey, createQuery, {
		unsubscribe: (entry) => {
			if (import.meta.env.DEV) {
				console.debug('unsubscribing from ConvexQuery ' + getFunctionName(query));
			}
			entry.resource.unsubscribe?.();
		}
	});
}

export const [getConvexQueryCache, setConvexQueryCache] =
	createContext<Cache<ConvexQuery<any, any>>>();
