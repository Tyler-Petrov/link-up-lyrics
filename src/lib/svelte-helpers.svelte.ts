import { goto } from "$app/navigation";
import { getContext, setContext } from "svelte";

export function redirectIfFalsy<T>(value: T | undefined | null, redirect: string) {
    if (!value) {
        goto(redirect, {
            invalidateAll: true,
        });
    }
    return value!;
}

export function createCustomContext<T>(key: symbol | string) {
    function getCustomContext() {
        return getContext<T>(key);
    }

    function setCustomContext(intialData: T) {
        const state = $state(intialData);
        setContext(key, state);
        return state;
    }

    return [
        getCustomContext,
        setCustomContext,
    ] as const
}

type LinkState = {
    navigatingComponentId: string | undefined;
};

const LINK_STATE_CTX = "LINK_STATE_CTX";

export const [getLinkState, setLinkState] = createCustomContext<LinkState>(LINK_STATE_CTX);