import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { env, httpAction } from './_generated/server';

const http = httpRouter();

/*
 * Clerk webhooks (Dashboard → Webhooks → endpoint `${CONVEX_SITE_URL}/clerk-webhook`). Billing events mirror
 * the subscription onto the User row; everything else is acknowledged and ignored. §13.3.2.
 */
http.route({
	path: '/clerk-webhook',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		const body = await request.text();
		if (!env.CLERK_WEBHOOK_SIGNING_SECRET)
			return new Response('Webhook not configured', { status: 503 });
		if (!(await verifySvix(env.CLERK_WEBHOOK_SIGNING_SECRET, request.headers, body)))
			return new Response('Invalid signature', { status: 401 });

		const event: unknown = JSON.parse(body);
		const item = parseSubscriptionItemEvent(event);
		if (item === undefined) return new Response(null, { status: 204 });
		if (item === null) return new Response('Unexpected subscription item payload', { status: 400 });
		await ctx.runMutation(internal.billing.applySubscriptionItemEvent, item);
		return new Response(null, { status: 204 });
	})
});

/** A `subscriptionItem.*` event's fields, undefined for other events, null when the payload isn't as expected. */
function parseSubscriptionItemEvent(event: unknown) {
	if (!isRecord(event) || typeof event.type !== 'string') return null;
	if (!event.type.startsWith('subscriptionItem.')) return undefined;
	const data = event.data;
	if (!isRecord(data) || !isRecord(data.payer) || !isRecord(data.plan)) return null;
	const { user_id: clerkUserId } = data.payer;
	const { slug: planSlug } = data.plan;
	// Organization payers have no user_id; v1 bills people only. §12.
	if (typeof clerkUserId !== 'string' || typeof planSlug !== 'string') return undefined;
	return { type: event.type, clerkUserId, planSlug, isFreeTrial: data.is_free_trial === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Svix signature check (what Clerk signs webhooks with), on WebCrypto so it runs without Node. */
async function verifySvix(secret: string, headers: Headers, body: string) {
	const id = headers.get('svix-id');
	const timestamp = headers.get('svix-timestamp');
	const signatures = headers.get('svix-signature');
	if (!id || !timestamp || !signatures) return false;
	// Reject replays older (or newer) than five minutes.
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0)),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signed = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(`${id}.${timestamp}.${body}`)
	);
	const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
	// "v1,<base64> v1,<base64>": any one matching is enough (secrets rotate).
	return signatures.split(' ').some((signature) => signature === `v1,${expected}`);
}

export default http;
