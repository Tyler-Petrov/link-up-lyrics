import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { env, httpAction, type ActionCtx } from './_generated/server';

/*
 * Webhook senders for dev (the Clerk development instance's webhooks) point here instead of at one deployment,
 * since every worktree has its own. `pnpm dev` leases this proxy while it runs (scripts/dev-service.mjs).
 */
const http = httpRouter();

// The name Convex gives a deployment, e.g. "wandering-newt-261". Accepting only names keeps forwarding
// confined to Convex deployments.
const DEPLOYMENT_NAME = /^[a-z]+-[a-z]+-\d+$/;

const CLAIM = '/worktree-proxy/claim';

// Replies with the paths the deployment claims, or 409 when it holds no lease.
const leaseHandler = (
	handle: (ctx: ActionCtx, deployment: string, path: string) => Promise<string[] | null>
) =>
	httpAction(async (ctx, req) => {
		if (req.headers.get('Authorization') !== `Bearer ${env.WORKTREE_PROXY_SECRET}`) {
			return new Response('Unauthorized', { status: 401 });
		}
		const body: unknown = await req.json().catch(() => null);
		const deployment =
			typeof body === 'object' && body !== null && 'deployment' in body ? body.deployment : null;
		if (typeof deployment !== 'string' || !DEPLOYMENT_NAME.test(deployment)) {
			return new Response('Expected { deployment: <Convex deployment name> }', { status: 400 });
		}
		// A claim's path follows /worktree-proxy/claim, e.g. /worktree-proxy/claim/clerk-webhook.
		const path = new URL(req.url).pathname.slice(CLAIM.length);
		const routes = await handle(ctx, deployment, path);
		return routes
			? Response.json({ routes })
			: new Response('This deployment holds no lease', { status: 409 });
	});

// Exact routes take precedence over prefixes, and longer prefixes over the catch-all below.
http.route({
	path: '/worktree-proxy/lease',
	method: 'POST',
	handler: leaseHandler((ctx, deployment) => ctx.runMutation(internal.targets.lease, { deployment }))
});
http.route({
	path: '/worktree-proxy/lease',
	method: 'DELETE',
	handler: leaseHandler((ctx, deployment) =>
		ctx.runMutation(internal.targets.release, { deployment })
	)
});
http.route({
	pathPrefix: `${CLAIM}/`,
	method: 'POST',
	handler: leaseHandler((ctx, deployment, path) =>
		ctx.runMutation(internal.targets.claim, { deployment, path })
	)
});
http.route({
	pathPrefix: `${CLAIM}/`,
	method: 'DELETE',
	handler: leaseHandler((ctx, deployment, path) =>
		ctx.runMutation(internal.targets.unclaim, { deployment, path })
	)
});

// A path a worktree claimed goes only to it, and the sender gets its reply, as if it pointed straight at that
// worktree. Every other webhook is acknowledged right away and goes to each worktree listening, so senders never
// retry or disable the endpoint because of a worktree.
http.route({
	pathPrefix: '/',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		const targets = await ctx.runQuery(internal.targets.active, { now: Date.now() });
		const { pathname, search } = new URL(req.url);
		const headers = Object.fromEntries(
			[...req.headers].filter(([name]) => name !== 'host' && name !== 'content-length')
		);
		const body = await req.arrayBuffer();
		const claimant = targets.find((target) => target.routes.includes(pathname));
		if (!claimant) {
			if (targets.length) {
				await ctx.scheduler.runAfter(0, internal.targets.forward, {
					deployments: targets.map((target) => target.deployment),
					pathAndQuery: pathname + search,
					headers,
					body
				});
			}
			return new Response(null, { status: 200 });
		}
		const url = `https://${claimant.deployment}.convex.site${pathname}${search}`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body,
				signal: AbortSignal.timeout(14_000)
			});
			console.log(`${response.status} ${url}`);
			// fetch already decoded the body, so its encoding and length headers no longer apply.
			const contentType = response.headers.get('Content-Type');
			// A 204 has no body, and a Response given one throws.
			return new Response(response.body && (await response.arrayBuffer()), {
				status: response.status,
				headers: contentType ? { 'Content-Type': contentType } : {}
			});
		} catch (error) {
			console.error(`Failed ${url}:`, error);
			return new Response("The worktree claiming this path didn't answer", { status: 502 });
		}
	})
});

export default http;
