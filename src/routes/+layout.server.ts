import { createAuth } from '../convex/auth';
import type { LayoutServerLoad } from './$types';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const load = (async ({ cookies }) => {
    return {
        token: await getToken(createAuth, cookies)
    };
}) satisfies LayoutServerLoad;