import { createCustomContext } from "./svelte-helpers.svelte";
import { browser } from "$app/environment";
import { authClient } from "./auth-client";
import type { ConvexClient } from "convex/browser";

export type AuthState = {
    isAuthenticated: boolean
}

export const [
    useAuth,
    setAuthContext
] = createCustomContext<AuthState>("AUTH_CTX")

export function setConvexAuth(convexClient: ConvexClient, initialTokenCb: () => string | null, onAuthChange: (isAuthenticated: boolean) => void) {
    let firstRun = true
	convexClient.setAuth(async ({ forceRefreshToken }) => {
        const initialToken = initialTokenCb();
		if (!browser || (!forceRefreshToken && firstRun)) {
            firstRun = false
			return initialToken;
		}
        return await authClient.convex.token()
            .then((response) => response.data?.token ?? null);
	}, onAuthChange);
}
