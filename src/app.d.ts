/// <reference types="svelte-clerk/env" />
// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** The signed-in person's Convex token, so the browser can authenticate Convex before Clerk loads. */
			convexToken: string | undefined;
		}
	}
}

export {};
