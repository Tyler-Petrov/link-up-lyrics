import { useConvexClient } from "convex-svelte"
import { getFunctionName, type FunctionReference } from "convex/server"
import { convexToJson } from "convex/values"
import { cacheResource, type Cache } from "./cache.svelte"
import { createCustomContext } from "./svelte-helpers.svelte"
import { browser } from "$app/environment"
import { hydratable } from "svelte";

const errorKey = Symbol("convex-query-error-Key")

export class ConvexQuery<
    Query extends FunctionReference<'query', 'public'>,
    QueryResult = Query['_returnType'],
> {
    unsubscribe: (() => void) | undefined = undefined;
    #args: Query['_args']

    #promise: Promise<QueryResult>
    #key: string
    #current: Query['_returnType'] | undefined = $state.raw(undefined)

    constructor(
        { query, args, key }: {
            query: Query,
            args: Query['_args'],
            key: string,
        }
    ) {
        const client = useConvexClient()

        this.#key = key
        this.#args = args

        const initalQuery = async () => {
            const result = await client.query(query, this.#args)
            this.#current = result
            return result
        }
        this.#promise = $state.raw(initalQuery())

        if (browser) {
            this.unsubscribe = client.onUpdate(
                query,
                this.#args,
                (result: Query['_returnType']) => {
                    // The first value is resolved by the promise, so we don't need to update the query here
                    if (this.#current === undefined) return

                    this.#current = result
                    this.#promise = Promise.resolve(result)
                },
                async (error) => {
                    this.#current = undefined
                    this.#promise = Promise.reject(error)
                }
            )
        }
    }

    get then() {
        const promise = this.#promise
        const hydratedPromise = hydratable(this.#key, () => 
            promise.catch((error) => ({ [errorKey]: error }))
        );

        return async (resolve?: (value: QueryResult) => void, reject?: (reason: any) => void) => {
            const value = await hydratedPromise;
            if (
                typeof value === "object"
                && value !== null
                && errorKey in value
            ) {
                return reject?.(value[errorKey])
            }

            return resolve?.(value)
        }
    }

    get current() {
        return this.#current
    }
}

export function generateCacheKey<
    Query extends FunctionReference<'query', 'public'>
>(
    query: Query,
    args: Query['_args'],
) {
    try {
        convexToJson(args)
    } catch (error) {
        const argsTypes = Object.fromEntries(
            Object.entries(args).map(([key, value]) => [key, typeof value]),
        )
        throw new Error(`Invalid arguments for query ${getFunctionName(query)}: ${JSON.stringify(argsTypes)}`)
    }
    return `${getFunctionName(query)}-${JSON.stringify(args)}`
}

export function convexQuery<
    Query extends FunctionReference<'query', 'public'>,
>(
    query: Query,
    args: Query['_args'],
) {
    const { env, ...rest } = args
    const cacheKey = generateCacheKey(query, rest)
    const createQuery = () => new ConvexQuery({ query, args, key: cacheKey })

    const cache = getConvexQueryCache()
    return cacheResource(
        cache,
        cacheKey,
        () => {
            if (import.meta.env.DEV) {
                console.debug("creating new ConvexQuery " + getFunctionName(query))
            }
            return createQuery()
        },
        {
            unsubscribe: (entry) => {
                if (import.meta.env.DEV) {
                    console.debug("unsubscribing from ConvexQuery " + getFunctionName(query))
                }
                entry.resource.unsubscribe?.()
            },
        },
    )
};

const CONVEX_QUERY_CACHE_CTX = "CONVEX_QUERY_CACHE_CTX"
export const [getConvexQueryCache, setConvexQueryCache] = createCustomContext<Cache<ConvexQuery<any, any>>>(CONVEX_QUERY_CACHE_CTX)
