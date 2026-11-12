import { createContext } from 'svelte';

/** Who's signed in, as the app sees it. Set by components/convex-clerk-setup.svelte in the root layout. */
export type Account = {
	/** Clerk knows who this is (from the server render until Clerk's script loads). */
	readonly isSignedIn: boolean;
	/** Their User row exists, so authQuery calls will work. Wait for this before rendering account pages. */
	readonly isReady: boolean;
};

export const [getAccount, setAccount] = createContext<Account>();
