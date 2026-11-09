// From Jairus. Dedupes resources (Convex subscriptions) by key and keeps them a few minutes after their last
// user, so returning to a page shows current data without waiting.
import { tick } from 'svelte';
import { browser } from '$app/env';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CacheEntry<T> = { count: number; resource: T };
export type Cache<T> = Map<string, CacheEntry<T>>;

/**
 * How long a resource outlives its last user. Queries stay subscribed, so going back to a page
 * opened in the last few minutes (like a visit after one of its tasks) shows current data
 * without waiting.
 */
const RETENTION_MS = 5 * 60 * 1000;

/** Convex unsubscribes aren't idempotent, so each entry is released once. */
const releasedEntries = new WeakSet<CacheEntry<unknown>>();

export function removeUnusedCachedValues<T>(
	cache: Cache<T>,
	cacheKey: string,
	entry: CacheEntry<T>,
	unsubscribe?: (entry: CacheEntry<T>) => boolean | undefined | void
) {
	void tick().then(() => {
		if (entry.count !== 0 || releasedEntries.has(entry)) return;
		// A failed entry has already left the cache, but its subscription still needs closing.
		const shouldDeleteCacheEntry = unsubscribe?.(entry) ?? true;
		if (shouldDeleteCacheEntry) {
			releasedEntries.add(entry);
			if (entry === cache.get(cacheKey)) cache.delete(cacheKey);
		}
	});
}

export function cacheResource<T, R extends T>(
	cache: Cache<R>,
	cacheKey: string,
	resource: () => T,
	options: {
		unsubscribe?: (entry: CacheEntry<T>) => boolean | undefined | void;
		shouldRecompute?: (cachedEntry: CacheEntry<T>) => boolean;
	} = {}
): T {
	let entry = cache.get(cacheKey);

	let tracking = true;
	try {
		$effect.pre(() => {
			if (entry) {
				console.debug('using cache entry', cacheKey);
				entry.count++;
			}
			return () => {
				// Release the entry this consumer counted, even if another one has replaced it.
				const counted = entry;
				wait(RETENTION_MS).then(() => {
					if (counted) {
						counted.count--;
						removeUnusedCachedValues(cache, cacheKey, counted, options.unsubscribe);
					}
				});
			};
		});
	} catch {
		tracking = false;
		console.warn('Tracking failed for Convex Query');
	}

	let resourceObject = entry?.resource as T | undefined;
	if (resourceObject === undefined || (entry && options.shouldRecompute?.(entry))) {
		resourceObject = resource();
		entry = {
			count: tracking ? 1 : 0,
			resource: resourceObject as R
		};
		cache.set(cacheKey, entry);

		// A server render's cache ends with the render, so there's nothing to release. Waiting on the
		// resource there would also start a query nothing on the server reads.
		if (!browser) return resourceObject;

		if (typeof (resourceObject as any)?.then === 'function') {
			(resourceObject as any)
				.then(() => {
					removeUnusedCachedValues(cache, cacheKey, entry!, options.unsubscribe);
				})
				.catch(() => {
					// Drop it so the next read retries. Its users still release it as usual.
					if (cache.get(cacheKey) === entry) cache.delete(cacheKey);
					removeUnusedCachedValues(cache, cacheKey, entry!, options.unsubscribe);
				});
		} else {
			removeUnusedCachedValues(cache, cacheKey, entry!, options.unsubscribe);
		}
	}

	return resourceObject;
}
